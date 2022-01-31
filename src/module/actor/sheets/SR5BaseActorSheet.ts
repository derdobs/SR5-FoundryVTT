import {Helpers} from "../../helpers";
import {SR5Item} from "../../item/SR5Item";
import {onManageActiveEffect, prepareActiveEffectCategories} from "../../effects";
import {SR5} from "../../config";
import {SkillEditSheet} from "../../apps/skills/SkillEditSheet";
import {SR5Actor} from "../SR5Actor";
import {KnowledgeSkillEditSheet} from "../../apps/skills/KnowledgeSkillEditSheet";
import {LanguageSkillEditSheet} from "../../apps/skills/LanguageSkillEditSheet";
import SR5SheetFilters = Shadowrun.SR5SheetFilters;
import SR5ActorSheetData = Shadowrun.SR5ActorSheetData;
import SkillField = Shadowrun.SkillField;
import Skills = Shadowrun.Skills;
import MatrixAttribute = Shadowrun.MatrixAttribute;

// Use SR5ActorSheet._showSkillEditForm to only ever render one SkillEditSheet instance.
// Should multiple instances be open, Foundry will cause cross talk between skills and actors,
// when opened in succession, causing SkillEditSheet to wrongfully overwrite the wrong data.
let globalSkillAppId: number = -1;

/**
 * This class should not be used directly but be extended for each actor type.
 *
 */
export class SR5BaseActorSheet extends ActorSheet {
    // What document description is shown on sheet. Allow displaying multiple descriptions at the same time.
    _shownDesc: string[] = [];
    // If something needs filtering, store those filters here.
    _filters: SR5SheetFilters = {
            skills: '', // filter based on user input and skill name/label.
            showUntrainedSkills: true, // filter based on pool size.
        };
    // Used to store the scroll position on rerender. Needed as Foundry fully re-renders on Document update.
    _scroll: string;
    // Store the currently selected inventory.
    selectedInventory: string;


    constructor(...args) {
        // @ts-ignore // Since we don't need any actual data, don't define args to avoid breaking changes.
        super(...args);

        // Preselect default inventory.
        this.selectedInventory = this.document.defaultInventory.name;
    }

    /**
     * All actors will handle these item types specifically.
     *
     * All others will be collected somewhere.
     *
     * @return A string of item types from the template.json Item section.
     */
    getHandledItemTypes(): string[] {
        return ['action'];
    }

    /**
     * All actors will always show these in their 'inventory'.
     * The inventory might be named differently for each actor.
     *
     * All other item types will only be shown when they've been added to that actor.
     * This allows all players/GMs to add item types to each actor that the system may not find useful
     * but the players/GMs might.
     *
     * @return An array of item types from the template.json Item section.
     */
    getInventoryItemTypes(): string[] {
        return [];
    }

    /**
     * These item types aren't allowed to be created on this actor sheet.
     *
     * This includes dropping them onto this actor.
     */
    getForbiddenItemTypes(): string[] {
        return [];
    }

    /**
     * Extend and override the default options used by the 5e Actor Sheet
     * @returns {Object}
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['sr5', 'sheet', 'actor'],
            width: 905,
            height: 690,
            tabs: [
                {
                    navSelector: '.tabs',
                    contentSelector: '.sheetbody',
                    initial: 'skills',
                },
            ],
        });
    }

    /**
     * Decide which template to render both for actor types and user permissions.
     *
     *
     * This could also be done within individual ActorType sheets, however, for ease of use, it's
     * centralized here.
     *
     * @override
     */
    get template() {
        const path = 'systems/shadowrun5e/dist/templates';

        if (this.actor.limited) {
            return `${path}/actor-limited/${this.actor.data.type}.html`;
        }

        return `${path}/actor/${this.actor.data.type}.html`;
    }

    /** SheetData used by _all_ actor types! */
    getData() {
        // Foundry v8 redesigned SheetData. To avoid restructuring all sheet templates, map new onto old and ignore it.
        let data = super.getData() as any;
        data = {
            ...data,
            // @ts-ignore
            data: data.data.data
        }

        // Sheet related general purpose fields. These aren't persistent.
        data.config = SR5;
        data.filters = this._filters;

        this._prepareActorAttributes(data);

        // Valid data fields for all actor types.
        // TODO: Remove _prepareItems method.
        this._prepareItems(data); // All actor types have items.
        this._prepareActorTypeFields(data);  // Actor type fields can be generic.
        this._prepareSkillsWithFilters(data); // All actor types have skills.

        data.effects = prepareActiveEffectCategories(this.document.effects);  // All actor types have effects.
        data.inventories = this._prepareItemsInventory();
        data.inventory = this._prepareSelectedInventory(data);
        data.selectedInventory = this.selectedInventory;

        return data;
    }

    /** Listeners used by _all_ actor types! */
    activateListeners(html) {
        super.activateListeners(html);

        // Active Effect management
        html.find(".effect-control").on('click',event => onManageActiveEffect(event, this.document));

        // General item CRUD management...
        html.find('.item-create').on('click', this._onItemCreate.bind(this));
        html.find('.item-edit').on('click', this._onItemEdit.bind(this));
        html.find('.item-delete').on('click', this._onItemDelete.bind(this));

        // General item header/list actions...
        html.find('.item-qty').on('change', this._onListItemChangeQuantity.bind(this));
        html.find('.item-rtg').on('change', this._onListItemChangeRating.bind(this));
        html.find('.item-equip-toggle').on('click', this._onListItemToggleEquipped.bind(this));

        // Item list description display handling...
        html.find('.hidden').hide();
        html.find('.has-desc').on('click', this._onListItemToggleDescriptionVisibility.bind(this));

        // General item test rolling...
        html.find('.item-roll').on('click', this._onItemRoll.bind(this));
        html.find('.Roll').on('click', this._onRoll.bind(this));

        // Actor inventory handling....
        html.find('.inventory-inline-create').on('click', this._onInventoryCreate.bind(this));
        html.find('.inventory-remove').on('click', this._onInventoryRemove.bind(this));
        html.find('.inventory-edit').on('click', this._onInplaceInventoryEdit.bind(this));
        html.find('.inventory-input-cancel').on('click', this._onInplaceInventoryEditCancel.bind(this));
        html.find('.inventory-input-save').on('click', this._onInplaceInventoryEditSave.bind(this));
        html.find('#select-inventory').on('change', this._onSelectInventory.bind(this));

        // Condition monitor track handling...
        html.find('.horizontal-cell-input .cell').on('click', this._onSetConditionTrackCell.bind(this));
        html.find('.horizontal-cell-input .cell').on('contextmenu', this._onClearConditionTrack.bind(this));

        // Matrix data handling...
        html.find('.marks-qty').on('change', this._onMarksQuantityChange.bind(this));
        html.find('.marks-add-one').on('click', async (event) => this._onMarksQuantityChangeBy(event, 1));
        html.find('.marks-remove-one').on('click', async (event) => this._onMarksQuantityChangeBy(event, -1));
        html.find('.marks-delete').on('click', this._onMarksDelete.bind(this));
        html.find('.marks-clear-all').on('click', this._onMarksClearAll.bind(this));

        // Skill Filter handling...
        html.find('.skill-header').find('.item-name').on('click', this._onFilterUntrainedSkills.bind(this));
        html.find('.skill-header').find('.skill-spec-item').on('click', this._onFilterUntrainedSkills.bind(this));
        html.find('.skill-header').find('.rtg').on('click', this._onFilterUntrainedSkills.bind(this));
        html.find('#filter-skills').on('input', this._onFilterSkills.bind(this));

        // Skill CRUD handling...
        html.find('.skill-edit').on('click', this._onShowEditSkill.bind(this));
        html.find('.knowledge-skill-edit').on('click', this._onShowEditKnowledgeSkill.bind(this));
        html.find('.language-skill-edit').on('click', this._onShowEditLanguageSkill.bind(this));
        html.find('.add-knowledge').on('click', this._onAddKnowledgeSkill.bind(this));
        html.find('.add-language').on('click', this._onAddLanguageSkill.bind(this));
        html.find('.add-active').on('click', this._onAddActiveSkill.bind(this));
        html.find('.remove-knowledge').on('click', this._onRemoveKnowledgeSkill.bind(this));
        html.find('.remove-language').on('click', this._onRemoveLanguageSkill.bind(this));
        html.find('.remove-active').on('click', this._onRemoveActiveSkill.bind(this));

        // Attribute test rolling...
        html.find('.attribute-roll').on('click', this._onRollAttribute.bind(this));

        // Conditon monitor test rolling...
        html.find('.cell-input-roll').on('click', this._onRollCellInput.bind(this));

        // Skill test rolling...
        html.find('.skill-roll').on('click', this._onRollActiveSkill.bind(this));
        html.find('.knowledge-skill').on('click', this._onRollKnowledgeSkill.bind(this));
        html.find('.language-skill').on('click', this._onRollLanguageSkill.bind(this));

        // Misc. actor actions...
        html.find('.show-hidden-skills').on('click', this._onShowHiddenSkills.bind(this));
        html.find('.open-source-pdf').on('click', this._onOpenSourcePDF.bind(this));
        html.find('.list-item').each(this._addDragSupportToListItemTemplatePartial.bind(this));
    }

    /**
     * Handle display of item types within the actors inventory section.
     *
     * Handled means there is some place specific the actor sheet want's these items displayed.
     * Unexpected means there is no use for this type but the user added it anyway.
     * Inventory types means they should always be shown, even if there are none.
     * All other item types will be collected at some tab / place on the sheet.
     */
    _removeHandledInventory(inventory) {
        // Remove item types that are specifically handled outside the inventory.
        const handledTypes = this.getHandledItemTypes();
        for (const type of handledTypes) {
            delete inventory.types[type];
        }

        // Show all item types but remove empty unexpected item types.
        const inventoryTypes = this.getInventoryItemTypes();
        for (const type of Object.keys(inventory.types)) {
            if (inventoryTypes.includes(type)) continue;
            if (inventory.types[type].items.length === 0) delete inventory.types[type];
        }

        return inventory;
    }

    /**
     * Add any item type to the inventory display that's configured for this actor sheet type.
     *
     * @param inventory The inventory to check and add types to.
     */
    _addInventoryTypes(inventory) {
        const inventoryTypes = this.getInventoryItemTypes();
        for (const type of inventoryTypes) {
            if (inventory.types.hasOwnProperty(type)) continue;

            inventory.types[type] = {
                type: type,
                label: SR5.itemTypes[type],
                items: []
            };
        }
    }

    /**
     * @override Default drag start handler to add Skill support
     * @param event
     */
    async _onDragStart(event) {
        // Create drag data
        const dragData = {
            actorId: this.actor.id,
            sceneId: this.actor.isToken ? canvas.scene?.id : null,
            tokenId: this.actor.isToken ? this.actor.token?.id : null,
            type: '',
            data: {}
        };

        // Handle different item type data transfers.
        // These handlers depend on behavior of the template partial ListItem.html.
        const element = event.currentTarget;
        switch (element.dataset.itemType) {
            // Skill data transfer. (Active and language skills)
            case 'skill':
                // Prepare data transfer
                dragData.type = 'Skill';
                dragData.data = {
                    skillId: element.dataset.itemId,
                    skill: this.actor.getSkill(element.dataset.itemId)
                };

                // Set data transfer
                event.dataTransfer.setData("text/plain", JSON.stringify(dragData));

                return;

            // Knowlege skill data transfer
            case 'knowledgeskill':
                // Knowledge skills have a multi purpose id built: <id>.<knowledge_category>
                const skillId = element.dataset.itemId.includes('.') ? element.dataset.itemId.split('.')[0] : element.dataset.itemId;

                dragData.type = 'Skill';
                dragData.data = {
                    skillId,
                    skill: this.actor.getSkill(skillId)
                };

                // Set data transfer
                event.dataTransfer.setData("text/plain", JSON.stringify(dragData));

                return;

            // All default Foundry data transfer.
            default:
                // Let default Foundry handler deal with default drag cases.
                return super._onDragStart(event);
        }
    }

    /** Handle all document drops onto all actor sheet types.
     *
     * @param event
     */
    // @ts-ignore
    async _onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();

        if (!event.dataTransfer) return;

        // const dropData = JSON.parse(event.dataTransfer.getData('text/plain'));
        // Handle specific system drop events.

        // Handle none specific drop events.
        return super._onDrop(event);
    }

    /**
     * Enhance Foundry state restore on rerender by more user interaction state.
     * @override
     */
    async _render(...args) {
        const focus = this._saveInputCursorPosition();
        this._saveScrollPositions();

        await super._render(...args);

        this._restoreScrollPositions();
        this._restoreInputCursorPosition(focus);
    }

    /**
     * Use together with _restoreInputCursorPosition during render calls.
     * Without this the cursor will always be on the first character, causing writing in reverse.
     */
    _saveInputCursorPosition(): any|null {
        const focusList = $(this.element).find('input:focus');
        return focusList.length ? focusList[0] : null;
    }

    /**
     * Use together with _restoreInputCursorPosition during render calls.
     */
    _restoreInputCursorPosition(focus) {
        if (focus && focus.name) {
            if (!this.form) return;

            const element = this.form[focus.name];
            if (element) {
                // Set general focus for allem input types.
                element.focus();

                // Set selection range for supported input types.
                if (['checkbox', 'radio'].includes(element.type)) return;
                // set the selection range on the focus formed from before (keeps track of cursor in input)
                element.setSelectionRange && element.setSelectionRange(focus.selectionStart, focus.selectionEnd);
            }
        }

    }

    /**
     * Used together with _restoreScrollPositions during render calls.
     * @private
     */
    _saveScrollPositions() {
        const activeList = this._findActiveList();
        if (activeList.length) {
            this._scroll = activeList.prop('scrollTop');
        }
    }

    /**
     * Used together with _storeScrollPositions during render calls.
     * @private
     */
    _restoreScrollPositions() {
        const activeList = this._findActiveList();
        if (activeList.length && this._scroll != null) {
            activeList.prop('scrollTop', this._scroll);
        }
    }

    /**
     * Return scroll area of the currently opened tab.
     * @private
     */
    _findActiveList() {
        return $(this.element).find('.tab.active .scroll-area');
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const type = Helpers.listItemId(event);
        // TODO: Add translation for item names...
        const itemData = {
            name: `New ${type}`,
            type: type,
        };
        return await this.actor.createEmbeddedDocuments('Item',  [itemData], {renderSheet: true});
    }

    async _onItemEdit(event) {
        event.preventDefault();
        const iid = Helpers.listItemId(event);
        const item = this.actor.items.get(iid);
        if (item) await item.sheet?.render(true);
    }

    async _onItemDelete(event) {
        event.preventDefault();

        const userConsented = await Helpers.confirmDeletion();
        if (!userConsented) return;

        const iid = Helpers.listItemId(event);
        return await this.actor.deleteEmbeddedDocuments('Item', [iid]);
    }

    async _onItemRoll(event) {
        event.preventDefault();
        const iid = Helpers.listItemId(event);
        const item = this.actor.items.get(iid);
        if (item) {
            await item.castAction(event);
        }
    }

    /**
     * Setup all general system rolls after clicking on their roll on the sheet.
     *
     * @param event Must contain a currentTarget with a rollId dataset
     */
    async _onRoll(event) {
        event.preventDefault();

        // look for roll id data in the current line
        let rollId = $(event.currentTarget).data()?.rollId;
        // if that doesn't exist, look for a prent with RollId name
        rollId = rollId ?? $(event.currentTarget).parent('.RollId').data().rollId;

        const split = rollId.split('.');
        const options = { event };
        switch (split[0]) {
            case 'prompt-roll':
                await this.actor.promptRoll(options);
                break;
            case 'armor':
                await this.actor.rollArmor(options);
                break;
            case 'fade':
                await this.actor.rollFade(options);
                break;
            case 'drain':
                await this.actor.rollDrain(options);
                break;
            case 'defense':
                await this.actor.rollAttackDefense(options);
                break;
            case 'damage-resist':
                await this.actor.rollSoak(options);
                break;

            // attribute only rolls
            case 'composure':
                await this.actor.rollAttributesTest('composure');
                break;
            case 'judge-intentions':
                await this.actor.rollAttributesTest('judge_intentions');
                break;
            case 'lift-carry':
                await this.actor.rollAttributesTest('lift_carry');
                break;
            case 'memory':
                await this.actor.rollAttributesTest('memory');
                break;

            case 'vehicle-stat':
                console.log('roll vehicle stat', rollId);
                break;

            case 'drone':
                const droneRoll = split[1];
                switch (droneRoll) {
                    case 'perception':
                        await this.actor.rollDronePerception(options);
                        break;
                    case 'infiltration':
                        await this.actor.rollDroneInfiltration(options);
                        break;
                    case 'pilot-vehicle':
                        await this.actor.rollPilotVehicle(options);
                        break;
                }
                break;
            // end drone

            case 'attribute':
                const attribute = split[1];
                if (attribute) {
                    await this.actor.rollAttribute(attribute, options);
                }
                break;
            // end attribute

            case 'skill':
                const skillType = split[1];
                switch (skillType) {
                    case 'active': {
                        const skillId = split[2];
                        await this.actor.rollActiveSkill(skillId, options);
                        break;
                    }
                    case 'language': {
                        const skillId = split[2];
                        await this.actor.rollLanguageSkill(skillId, options);
                        break;
                    }
                    case 'knowledge': {
                        const category = split[2];
                        const skillId = split[3];
                        await this.actor.rollKnowledgeSkill(category, skillId, options);
                        break;
                    }
                }
                break;
            // end skill

            case 'matrix':
                const matrixRoll = split[1];
                switch (matrixRoll) {
                    case 'attribute':
                        const attr = split[2];
                        await this.actor.rollMatrixAttribute(attr, options);
                        break;
                    case 'device-rating':
                        await this.actor.rollDeviceRating(options);
                        break;
                }

                break;
            // end matrix
        }
    }

    /**
     * Set any kind of condition monitor to a specific cell value.
     *
     * @event Most return a currentTarget with a value dataset
     */
    async _onSetConditionTrackCell(event) {
        event.preventDefault();

        const value = Number(event.currentTarget.dataset.value);
        const cmId = $(event.currentTarget).closest('.horizontal-cell-input').data().id;
        const data = {};
        if (cmId === 'stun' || cmId === 'physical') {
            const property = `data.track.${cmId}.value`;
            data[property] = value;
        } else if (cmId === 'edge') {
            const property = `data.attributes.edge.uses`;
            data[property] = value;
        } else if (cmId === 'overflow') {
            const property = 'data.track.physical.overflow.value';
            data[property] = value;
        } else if (cmId === 'matrix') {
            const matrixDevice = this.actor.getMatrixDevice();
            if (matrixDevice && !isNaN(value)) {
                const updateData = {};
                updateData['data.technology.condition_monitor.value'] = value;
                await matrixDevice.update(updateData);
            } else {
                const property = `data.track.matrix.value`;
                data[property] = value;
            }
        }
        await this.actor.update(data);
    }

    /**
     * Reset all condition tracks to zero values.
     * @param event
     */
    async _onClearConditionTrack(event) {
        event.preventDefault();

        const cmId = $(event.currentTarget).closest('.horizontal-cell-input').data().id;
        const data = {};
        if (cmId === 'stun') {
            data[`data.track.stun.value`] = 0;
        }
        // Clearing the physical monitor should also clear the overflow.
        else if (cmId === 'physical') {
            data[`data.track.physical.value`] = 0;
            data['data.track.physical.overflow.value'] = 0;

        } else if (cmId === 'edge') {
            data[`data.attributes.edge.uses`] = 0;

        } else if (cmId === 'overflow') {
            data['data.track.physical.overflow.value'] = 0;

        } else if (cmId === 'matrix') {
            const matrixDevice = this.actor.getMatrixDevice();

            if (matrixDevice) {
                const updateData = {};
                updateData['data.technology.condition_monitor.value'] = 0;
                await matrixDevice.update(updateData);

            } else {
                data['data.track.matrix.value'] = 0;
            }
        }

        await this.actor.update(data);
    }

    _prepareActorAttributes(data: SR5ActorSheetData) {
        // Clear visible, zero value attributes temporary modifiers so they appear blank.
        const attributes = data.data.attributes;
        for (let [, attribute] of Object.entries(attributes)) {
            if (!attribute.hidden) {
                if (attribute.temp === 0) delete attribute.temp;
            }
        }
    }

    _prepareMatrixAttributes(data) {
        const { matrix } = data.data;
        if (matrix) {
            const cleanupAttribute = (attribute: MatrixAttribute) => {
                const att = matrix[attribute];
                if (att) {
                    if (!att.mod) att.mod = [];
                    if (att.temp === 0) delete att.temp;
                }
            };

            ['firewall', 'data_processing', 'sleaze', 'attack'].forEach((att: MatrixAttribute) => cleanupAttribute(att));
        }
    }

    /**
     * Prepare Actor Sheet Inventory display.
     *
     * Each item can  be in one custom inventory or the default inventory.
     */
    // TODO: Rebuild method to work with this.selectedInventory
    _prepareItemsInventory() {
        // All custom and default actor inventories.
        const inventories = {};
        // Simple item to inventory mapping.
        const itemIdInventory = {};

        // Build all inventories, group items by their types.
        Object.values(this.document.data.data.inventories).forEach(({name, label, itemIds}) => {
            inventories[name] = {
                name,
                label,
                types: {}
            }

            itemIds.forEach(id => {
                if (itemIdInventory[id]) console.warn(`Shadowrun5e | Item id ${id} has been added to both ${name} and ${itemIdInventory[id]}. Will only show in ${name}`);
                itemIdInventory[id] = name;
            });
        });

        // Default inventory for items without a defined one.
        inventories[this.document.defaultInventory.name] = {
            name: this.document.defaultInventory.name,
            label: this.document.defaultInventory.label,
            types: {}
        };

        // Fill all inventories with items grouped by their type.
        this.document.items.forEach(item => {
            // Since fields will be added, duplicate the item to avoid those propagating into #update calls.
            const sheetItem = duplicate(item);

            // Create ChatData to be displayed in chat and description.
            const chatData = item.getChatData();
            // TODO: Add ChatData and ItemSheetData typing.
            // @ts-ignore
            sheetItem.description = chatData.description;
            // @ts-ignore
            sheetItem.properties = chatData.properties;

            // TODO: isStack property isn't used elsewhere. Remove if unnecessary.
            // @ts-ignore
            // sheetItem.isStack = sheetItem.data.quantity ? item.data.quantity > 1 : false;

            const inventoryName = itemIdInventory[item.id] || this.document.defaultInventory.name;
            const inventory = inventories[inventoryName];

            // Build item type structure per inventory
            if (!inventory.types[item.type]) {
                inventory.types[item.type] = {
                    type: item.type,
                    label: SR5.itemTypes[item.type],
                    items: []
                };
            }

            inventory.types[item.type].items.push(sheetItem);
        });

        Object.values(inventories).forEach(inventory => {
            this._removeHandledInventory(inventory);
            this._addInventoryTypes(inventory);
        });

        // Prepared sorting methods.
        const sortByName = (i1, i2) => {
            if (i1.name > i2.name) return 1;
            if (i1.name < i2.name) return -1;
            return 0;
        };
        const sortByEquipped = (left, right) => {
            const leftEquipped = left.data?.technology?.equipped;
            const rightEquipped = right.data?.technology?.equipped;
            if (leftEquipped && !rightEquipped) return -1;
            if (rightEquipped && !leftEquipped) return 1;
            if (left.name > right.name) return 1;
            if (left.name < right.name) return -1;
            return 0;
        };

        // Sort the items within each inventory.
        Object.values(inventories).forEach(({types}) =>
            Object.values(types).forEach((type: {items: []}) => {
                // TODO: Check if some / all should be sort by equipped.
                type.items.sort(sortByName);
            })
        );

        return inventories;
    }

    /**
     * Choose the selected inventory to actually display.
     *
     * @param data
     */
    _prepareSelectedInventory(data) {
        return data.inventories[this.selectedInventory];
    }

    /**
     * Prepare Actor Sheet data with item data.
     * @param data An object containing Actor Sheet data, as would be returned by ActorSheet.getData
     */
    _prepareItems(data) {
        const inventory = {};

        // All acting entities should be allowed to carry some protection!
        inventory['weapon'] = {
            label: game.i18n.localize('SR5.ItemTypes.Weapon'),
            items: [],
            dataset: {
                type: 'weapon',
            },
        };

        // Critters are people to... Support your local HMHVV support groups!
        if (this.actor.matchesActorTypes(['character', 'critter', 'vehicle'])) {
            inventory['armor'] = {
                label: game.i18n.localize('SR5.ItemTypes.Armor'),
                items: [],
                dataset: {
                    type: 'armor',
                },
            };
            inventory['device'] = {
                label: game.i18n.localize('SR5.ItemTypes.Device'),
                items: [],
                dataset: {
                    type: 'device',
                },
            };
            inventory['equipment'] = {
                label: game.i18n.localize('SR5.ItemTypes.Equipment'),
                items: [],
                dataset: {
                    type: 'equipment',
                },
            };
            inventory['ammo'] = {
                label: game.i18n.localize('SR5.ItemTypes.Ammo'),
                items: [],
                dataset: {
                    type: 'ammo',
                },
            };
            inventory['cyberware'] = {
                label: game.i18n.localize('SR5.ItemTypes.Cyberware'),
                items: [],
                dataset: {
                    type: 'cyberware',
                },
            };
            inventory['bioware'] = {
                label: game.i18n.localize('SR5.ItemTypes.Bioware'),
                items: [],
                dataset: {
                    type: 'bioware',
                },
            };
        }

        let [
            items,
            spells,
            qualities,
            adept_powers,
            actions,
            complex_forms,
            lifestyles,
            contacts,
            sins,
            programs,
            critter_powers,
            sprite_powers,
        ] = data.items.reduce(
            (arr, item) => {
                // Duplicate to avoid later updates propagating changed item data.
                // NOTE: If no duplication is done, added fields will be stored in the database on updates!
                item = duplicate(item);
                // Show item properties and description in the item list overviews.
                const actorItem = this.actor.items.get(item._id) as SR5Item;
                const chatData = actorItem.getChatData();
                item.description = chatData.description;
                // @ts-ignore // This is a hacky monkey patch solution to pass template data through duplicated item data.
                item.properties = chatData.properties;

                // TODO: isStack property isn't used elsewhere. Remove if unnecessary.
                item.isStack = item.data.quantity ? item.data.quantity > 1 : false;
                if (item.type === 'spell') arr[1].push(item);
                else if (item.type === 'quality') arr[2].push(item);
                else if (item.type === 'adept_power') arr[3].push(item);
                else if (item.type === 'action') arr[4].push(item);
                else if (item.type === 'complex_form') arr[5].push(item);
                else if (item.type === 'lifestyle') arr[6].push(item);
                else if (item.type === 'contact') arr[7].push(item);
                else if (item.type === 'sin') arr[8].push(item);
                else if (item.type === 'program') arr[9].push(item);
                else if (item.type === 'critter_power') arr[10].push(item);
                else if (item.type === 'sprite_power') arr[11].push(item);
                else if (Object.keys(inventory).includes(item.type)) arr[0].push(item);
                return arr;
            },
            [[], [], [], [], [], [], [], [], [], [], [], []],
        );

        const sortByName = (i1, i2) => {
            if (i1.name > i2.name) return 1;
            if (i1.name < i2.name) return -1;
            return 0;
        };
        const sortByEquipped = (left, right) => {
            const leftEquipped = left.data?.technology?.equipped;
            const rightEquipped = right.data?.technology?.equipped;
            if (leftEquipped && !rightEquipped) return -1;
            if (rightEquipped && !leftEquipped) return 1;
            if (left.name > right.name) return 1;
            if (left.name < right.name) return -1;
            return 0;
        };
        actions.sort(sortByName);
        adept_powers.sort(sortByName);
        complex_forms.sort(sortByName);
        items.sort(sortByEquipped);
        spells.sort(sortByName);
        contacts.sort(sortByName);
        lifestyles.sort(sortByName);
        sins.sort(sortByName);
        programs.sort(sortByEquipped);
        critter_powers.sort(sortByName);
        sprite_powers.sort(sortByName);

        items.forEach((item) => {
            inventory[item.type].items.push(item);
        });

        data.inventory = Object.values(inventory);
        data.magic = {
            spellbook: spells,
            powers: adept_powers,
        };
        data.actions = actions;
        data.complex_forms = complex_forms;
        data.lifestyles = lifestyles;
        data.contacts = contacts;
        data.sins = sins;
        data.programs = programs;
        data.critter_powers = critter_powers;
        data.sprite_powers = sprite_powers;

        qualities.sort((a, b) => {
            if (a.data.type === 'positive' && b.data.type === 'negative') return -1;
            if (a.data.type === 'negative' && b.data.type === 'positive') return 1;
            return a.name < b.name ? -1 : 1;
        });
        data.qualities = qualities;
    }

    /**
     * @param data An object containing Actor Sheet data, as would be returned by ActorSheet.getData
     */
    _prepareActorTypeFields(data) {
        data.isCharacter = this.actor.isCharacter();
        data.isSpirit = this.actor.isSpirit();
        data.isCritter = this.actor.isCritter();
        data.hasSkills = this.actor.hasSkills;
        data.hasSpecial = this.actor.hasSpecial;
    }

    async _onMarksQuantityChange(event) {
        event.stopPropagation();

        if (this.object.isIC() && this.object.hasHost()) {
            return ui.notifications?.info(game.i18n.localize('SR5.Infos.CantModifyHostContent'));
        }

        const markId = event.currentTarget.dataset.markId;
        if (!markId) return;

        const markedDocuments = Helpers.getMarkIdDocuments(markId);
        if (!markedDocuments) return;
        const {scene, target, item} = markedDocuments;
        if (!scene || !target) return; // item can be undefined.

        const marks = parseInt(event.currentTarget.value);
        await this.object.setMarks(target, marks, {scene, item, overwrite: true});
    }

    async _onMarksQuantityChangeBy(event, by: number) {
        event.stopPropagation();

        if (this.object.isIC() && this.object.hasHost()) {
            return ui.notifications?.info(game.i18n.localize('SR5.Infos.CantModifyHostContent'));
        }

        const markId = event.currentTarget.dataset.markId;
        if (!markId) return;

        const markedDocuments = Helpers.getMarkIdDocuments(markId);
        if (!markedDocuments) return;
        const {scene, target, item} = markedDocuments;
        if (!scene || !target) return; // item can be undefined.

        await this.object.setMarks(target, by, {scene, item});
    }

    async _onMarksDelete(event) {
        event.stopPropagation();

        if (this.object.isIC() && this.object.hasHost()) {
            return ui.notifications?.info(game.i18n.localize('SR5.Infos.CantModifyHostContent'));
        }

        const markId = event.currentTarget.dataset.markId;
        if (!markId) return;

        const userConsented = await Helpers.confirmDeletion();
        if (!userConsented) return;

        await this.object.clearMark(markId);
    }

    async _onMarksClearAll(event) {
        event.stopPropagation();

        if (this.object.isIC() && this.object.hasHost()) {
            return ui.notifications?.info(game.i18n.localize('SR5.Infos.CantModifyHostContent'));
        }

        const userConsented = await Helpers.confirmDeletion();
        if (!userConsented) return;

        await this.object.clearMarks();
    }

    _prepareSkillsWithFilters(data: SR5ActorSheetData) {
        this._filterActiveSkills(data);
        this._filterKnowledgeSkills(data);
        this._filterLanguageSkills(data);
    }

    _filterSkills(data: SR5ActorSheetData, skills: Skills) {
        const filteredSkills = {};
        for (let [key, skill] of Object.entries(skills)) {
            // Don't show hidden skills.
            if (skill.hidden) {
                continue;
            }
            // Filter visible skills.
            if (this._showSkill(key, skill, data)) {
                filteredSkills[key] = skill;
            }
        }

        return Helpers.sortSkills(filteredSkills);
    }

     _showSkill(key, skill, data) {
        if (this._showMagicSkills(key, skill, data)) {
            return true;
        }
        if (this._showResonanceSkills(key, skill, data)) {
            return true;
        }

        return this._showGeneralSkill(key, skill);
    }

    _showGeneralSkill(skillId, skill: SkillField) {
        return !this._isSkillMagic(skillId, skill) && !this._isSkillResonance(skill) && this._isSkillFiltered(skillId, skill);
    }

    _showMagicSkills(skillId, skill: SkillField, data: SR5ActorSheetData) {
        return this._isSkillMagic(skillId, skill) && data.data.special === 'magic' && this._isSkillFiltered(skillId, skill);
    }

    _showResonanceSkills(skillId, skill: SkillField, data: SR5ActorSheetData) {
        return this._isSkillResonance(skill) && data.data.special === 'resonance' && this._isSkillFiltered(skillId, skill);
    }

    _isSkillFiltered(skillId, skill) {
        // a newly created skill shouldn't be filtered, no matter what.
        // Therefore disqualify empty skill labels/names from filtering and always show them.
        const isFilterable = this._getSkillLabelOrName(skill).length > 0;
        const isHiddenForText = !this._doesSkillContainText(skillId, skill, this._filters.skills);
        const isHiddenForUntrained = !this._filters.showUntrainedSkills && skill.value === 0;

        return !(isFilterable && (isHiddenForUntrained || isHiddenForText));
    }

    _getSkillLabelOrName(skill) {
        return Helpers.getSkillLabelOrName(skill);
    }

    _doesSkillContainText(key, skill, text) {
        if (!text) {
            return true;
        }

        // Search both english keys, localized labels and all specializations.
        const name = this._getSkillLabelOrName(skill);
        const searchKey = skill.name === undefined ? key : '';
        // some "specs" were a string from old code I think
        const specs = skill.specs !== undefined && Array.isArray(skill.specs) ? skill.specs.join(' ') : '';
        let searchString = `${searchKey} ${name} ${specs}`;

        return searchString.toLowerCase().search(text.toLowerCase()) > -1;
    }

    _filterKnowledgeSkills(data: SR5ActorSheetData) {
        // Knowledge skill have separate sub-categories.
        Object.keys(SR5.knowledgeSkillCategories).forEach((category) => {
            if (!data.data.skills.knowledge.hasOwnProperty(category)) {
                console.warn(`Knowledge Skill doesn't provide configured category ${category}`);
                return;
            }
            data.data.skills.knowledge[category].value = this._filterSkills(data, data.data.skills.knowledge[category].value);
        });
    }

    _filterLanguageSkills(data: SR5ActorSheetData) {
        // Language Skills have no sub-categories.
        data.data.skills.language.value = this._filterSkills(data, data.data.skills.language.value);
    }

    _filterActiveSkills(data: SR5ActorSheetData) {
        // Handle active skills directly, as it doesn't use sub-categories.
        data.data.skills.active = this._filterSkills(data, data.data.skills.active);
    }

    _isSkillMagic(id, skill) {
        return skill.attribute === 'magic' || id === 'astral_combat' || id === 'assensing';
    }

    _isSkillResonance(skill) {
        return skill.attribute === 'resonance';
    }

    /** Setup untrained skill filter within getData */
    async _onFilterUntrainedSkills(event) {
        event.preventDefault();
        this._filters.showUntrainedSkills = !this._filters.showUntrainedSkills;
        await this.render();
    }

    /** Setup skill name filter within getData */
    async _onFilterSkills(event) {
        this._filters.skills = event.currentTarget.value;
        await this.render();
    }

    async _onRollActiveSkill(event) {
        event.preventDefault();
        const skill = Helpers.listItemId(event);
        return this.actor.rollActiveSkill(skill, { event: event });
    }

    async _onShowEditSkill(event) {
        event.preventDefault();
        const skill = Helpers.listItemId(event);
        // new SkillEditSheet(this.actor, skill, { event: event }).render(true);
        await this._showSkillEditForm(SkillEditSheet, this.actor, { event: event }, skill);
    }

    /** Keep track of each SkillEditSheet instance and close before opening another.
     *
     * @param skillEditFormImplementation Any extending class! of SkillEditSheet
     * @param actor
     * @param options
     * @param args Collect arguments of the different renderWithSkill implementations.
     */
    async _showSkillEditForm(skillEditFormImplementation, actor: SR5Actor, options: object, ...args) {
        await this._closeOpenSkillApp();

        const skillEditForm = new skillEditFormImplementation(actor, options, ...args);
        globalSkillAppId = skillEditForm.appId;
        await skillEditForm.render(true);
    }

    _onShowEditKnowledgeSkill(event) {
        event.preventDefault();
        const [skill, category] = Helpers.listItemId(event).split('.');

        this._showSkillEditForm(
            KnowledgeSkillEditSheet,
            this.actor,
            {
                event: event,
            },
            skill,
            category,
        );
    }

    async _onShowEditLanguageSkill(event) {
        event.preventDefault();
        const skill = Helpers.listItemId(event);
        // new LanguageSkillEditSheet(this.actor, skill, { event: event }).render(true);
        await this._showSkillEditForm(LanguageSkillEditSheet, this.actor, { event: event }, skill);
    }

    async _closeOpenSkillApp() {
        if (globalSkillAppId !== -1) {
            if (ui.windows[globalSkillAppId]) {
                await ui.windows[globalSkillAppId].close();
            }
            globalSkillAppId = -1;
        }
    }

    async _onAddLanguageSkill(event) {
        event.preventDefault();
        const skillId = await this.actor.addLanguageSkill({ name: '' });
        if (!skillId) return;

        // NOTE: Causes issues with adding knowledge skills (category undefined)
        // await this._showSkillEditForm(LanguageSkillEditSheet, this.actor, {event}, skillId);
    }

    async _onRemoveLanguageSkill(event) {
        event.preventDefault();

        const userConsented = await Helpers.confirmDeletion();
        if (!userConsented) return;

        const skillId = Helpers.listItemId(event);
        await this.actor.removeLanguageSkill(skillId);
    }

    async _onAddKnowledgeSkill(event) {
        event.preventDefault();
        const category = Helpers.listItemId(event);
        const skillId = await this.actor.addKnowledgeSkill(category);
        if (!skillId) return;

        // NOTE: Causes issues with adding knowledge skills (category undefined)
        // await this._showSkillEditForm(KnowledgeSkillEditSheet, this.actor, {event}, skillId);
    }

    async _onRemoveKnowledgeSkill(event) {
        event.preventDefault();

        const userConsented = await Helpers.confirmDeletion();
        if (!userConsented) return;

        const [skillId, category] = Helpers.listItemId(event).split('.');
        await this.actor.removeKnowledgeSkill(skillId, category);
    }

    /** Add an active skill and show the matching edit application afterwards.
     *
     * @param event The HTML event from which the action resulted.
     */
     async _onAddActiveSkill(event: Event) {
        event.preventDefault();
        const skillId = await this.actor.addActiveSkill();
        if (!skillId) return;

        await this._showSkillEditForm(SkillEditSheet, this.actor, { event: event }, skillId);
    }

    async _onRemoveActiveSkill(event: Event) {
         event.preventDefault();

        const userConsented = await Helpers.confirmDeletion();
        if (!userConsented) return;

        const skillId = Helpers.listItemId(event);
        await this.actor.removeActiveSkill(skillId);
    }

    async _onRollKnowledgeSkill(event) {
        event.preventDefault();
        const id = Helpers.listItemId(event);
        const [skill, category] = id.split('.');
        return this.actor.rollKnowledgeSkill(category, skill, { event: event });
    }

    async _onRollLanguageSkill(event) {
        event.preventDefault();
        const skill = Helpers.listItemId(event);
        return this.actor.rollLanguageSkill(skill, { event: event });
    }

    async _onRollAttribute(event) {
        event.preventDefault();
        const attribute = event.currentTarget.closest('.attribute').dataset.attribute;
        return this.actor.rollAttribute(attribute, {event: event});
    }

    async _onRollCellInput(event) {
        event.preventDefault();
        let track = $(event.currentTarget).closest('.horizontal-cell-input').data().id;
        if (track === 'stun' || track === 'physical') {
            await this.actor.rollNaturalRecovery(track, event);
        } else if (track === 'edge') {
            await this.actor.rollAttribute('edge');
        }
    }

    async _onShowHiddenSkills(event) {
        event.preventDefault();

        await this.actor.showHiddenSkills();
    }

    async _onOpenSourcePDF(event) {
        event.preventDefault();
        const field = $(event.currentTarget).parents('.list-item');
        const iid = $(field).data().itemId;
        const item = this.actor.items.get(iid);
        if (item) {
            await item.openPdfSource();
        }
    }
    /**
     * Augment each item of the ListItem template partial with drag support.
     * @param i
     * @param item
     */
    _addDragSupportToListItemTemplatePartial(i, item) {
        if (item.dataset && item.dataset.itemId) {
            item.setAttribute('draggable', true);
            item.addEventListener('dragstart', this._onDragStart.bind(this), false);
        }
    }

    /**
     * Change the quantity on an item shown within a sheet item list.
     */
    async _onListItemChangeQuantity(event) {
        const iid = Helpers.listItemId(event);
        const item = this.actor.items.get(iid);
        const qty = parseInt(event.currentTarget.value);
        if (item && qty && "technology" in item.data.data) {
            item.data.data.technology.quantity = qty;
            await item.update({ 'data.technology.quantity': qty });
        }
    }

    /**
     * Change the rating on an item shown within a sheet item list.
     */
    async _onListItemChangeRating(event) {
        const iid = Helpers.listItemId(event);
        const item = this.actor.items.get(iid);
        const rtg = parseInt(event.currentTarget.value);
        if (item && rtg) {
            await item.update({ 'data.technology.rating': rtg });
        }
    }

    /**
     * Change the equipped status of an item shown within a sheet item list.
     */
    async _onListItemToggleEquipped(event) {
        event.preventDefault();
        const iid = Helpers.listItemId(event);
        const item = this.actor.items.get(iid);
        if (item) {
            const newItems = [] as any[];

            // Handle the equipped state.
            if (item.isDevice()) {
                // Only allow one equipped device item. Unequip all other.
                for (const item of this.actor.items.filter(actorItem => actorItem.isDevice())) {
                    newItems.push({
                        '_id': item.id,
                        'data.technology.equipped': item.id === iid,
                    });
                }

            } else {
                // Toggle equip status.
                newItems.push({
                    '_id': iid,
                    'data.technology.equipped': !item.isEquipped(),
                });
            }

            // Handle active effects based on equipped status.
            // NOTE: This is commented out for later ease of enabling effects based on equip status AND if they are
            //       meant to enable on eqiup or not.
            // this.actor.effects.forEach(effect => {
            //     if (effect.data.origin !== item.uuid) return;
            //
            //     // @ts-ignore
            //     effect.disable(item.isEquipped());
            // })

            await this.actor.updateEmbeddedDocuments('Item', newItems);

            this.actor.render(false);
        }
    }

    /**
     * Show / hide the items description within a sheet item l ist.
     */
    async _onListItemToggleDescriptionVisibility(event) {
        event.preventDefault();
        const item = $(event.currentTarget).parents('.list-item');
        const iid = $(item).data().item;
        const field = item.next();
        field.toggle();
        if (iid) {
            if (field.is(':visible')) this._shownDesc.push(iid);
            else this._shownDesc = this._shownDesc.filter((val) => val !== iid);
        }
    }

    /**
     * Create an inventory place on the actor for gear organization.
     */
    async _onInventoryCreate(event) {
        event.preventDefault();

        // Overwrite currently selected inventory.
        $('#input-inventory').val('');
        await this._onInplaceInventoryEdit(event);
    }

    /**
     * Remove the currently selected inventory.
     * @param event
     */
    async _onInventoryRemove(event) {
        event.preventDefault();

        // TODO: Allow for options overwriting title/message and so forth.
        const userConsented = await Helpers.confirmDeletion();
        if (!userConsented) return;

        await this.document.removeInventory(this.selectedInventory);

        // Preselect default instead of none.
        this.selectedInventory = this.document.defaultInventory.name;
        this.render();
    }

    /**
     * Hide inventory selection and show inline editing instead.
     *
     * @param event
     */
    async _onInplaceInventoryEdit(event) {
        event.preventDefault();

        $('.selection-inventory').hide();
        $('.inline-input-inventory').show();
    }

    /**
     * Hide inline inventory editing and show inventory selection instead.
     *
     * Cancel edit workflow and do nothing.
     * @param event
     */
    async _onInplaceInventoryEditCancel(event) {
        event.preventDefault();

        $('.selection-inventory').show();
        $('.inline-input-inventory').hide();

        // Reset to selected inventory for next try.
        $('#input-inventory').val(this.selectedInventory);
    }

    /**
     * Complete inline editing and either save changes or create a missing inventory.
     *
     * @param event
     */
    // TODO: Editing doesn't work, as it will assume that it must be created.
    async _onInplaceInventoryEditSave(event) {
        event.preventDefault();

        const inputElement = $('#input-inventory');
        const inventory = String(inputElement.val());
        if (!inventory) return;

        if (!this.document.hasInventory(inventory))
            await this.document.createInventory(inventory);

        await this._onInplaceInventoryEditCancel(event);

        // Preselect the new inventory.
        this.selectedInventory = inventory;
        this.render();
    }

    /**
     * Change selected inventory for this sheet.
     *
     * @param event
     */
    async _onSelectInventory(event) {
        event.preventDefault();

        const inventory = String($(event.currentTarget).val());

        if (inventory)
            this.selectedInventory = inventory;

        this.render();
    }
}