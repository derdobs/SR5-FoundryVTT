import SR5ItemWithEmbedsSheet from './SR5ItemWithEmbedsSheet';
import { ItemType } from '../types/ItemType';

export default class SR5ArmorSheet extends SR5ItemWithEmbedsSheet {
    // <editor-fold desc="Static Properties"></editor-fold>
    // <editor-fold desc="Static Methods"></editor-fold>
    // <editor-fold desc="Properties"></editor-fold>
    // <editor-fold desc="Constructor & Initialization"></editor-fold>
    // <editor-fold desc="Getters & Setters">

    protected get validDropTypes(): ItemType[] {
        return [ItemType.Metatype];
    }

    get template(): string {
        return `systems/shadowrun5e/dist/templates/item/armor.html`;
    }

    // </editor-fold>
    // <editor-fold desc="Instance Methods">

    getData(): ItemSheetData {
        const data = super.getData();

        console.warn(`SR5ArmorSheet data for ${this.item.name}`);
        console.warn(data);

        return data;
    }

    // </editor-fold>
}