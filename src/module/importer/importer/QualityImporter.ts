import { DataImporter } from './DataImporter';
import { ImportHelper } from '../helper/ImportHelper';
import { QualityParserBase } from '../parser/quality/QualityParserBase';
import {DefaultValues} from "../../data/DataDefaults";
import QualityItemData = Shadowrun.QualityItemData;

export class QualityImporter extends DataImporter {
    public categoryTranslations: any;
    public itemTranslations: any;
    public files = ['qualities.xml'];

    CanParse(jsonObject: object): boolean {
        return jsonObject.hasOwnProperty('qualities') && jsonObject['qualities'].hasOwnProperty('quality');
    }

    GetDefaultData(): QualityItemData {
        return {
            name: 'Unnamed Armor',
            type: 'quality',
            data: {
                description: {
                    value: '',
                    chat: '',
                    source: '',
                },
                action: {
                    type: '',
                    category: '',
                    attribute: '',
                    attribute2: '',
                    skill: '',
                    spec: false,
                    mod: 0,
                    mod_description: '',
                    damage: DefaultValues.damageData({type: {base: '', value: ''}}),
                    limit: {
                        value: 0,
                        attribute: '',
                        mod: [],
                        base: 0,
                    },
                    extended: false,
                    opposed: {
                        type: '',
                        attribute: '',
                        attribute2: '',
                        skill: '',
                        mod: 0,
                        description: '',
                    },
                    alt_mod: 0,
                    dice_pool_mod: [],
                },
                type: '',
            },
        };
    }

    ExtractTranslation() {
        if (!DataImporter.jsoni18n) {
            return;
        }

        let jsonQualityi18n = ImportHelper.ExtractDataFileTranslation(DataImporter.jsoni18n, this.files[0]);
        this.categoryTranslations = ImportHelper.ExtractCategoriesTranslation(jsonQualityi18n);
        this.itemTranslations = ImportHelper.ExtractItemTranslation(jsonQualityi18n, 'qualities', 'quality');
    }

    async Parse(jsonObject: object): Promise<Item> {
        const jsonNameTranslations = {};
        const folders = await ImportHelper.MakeCategoryFolders(jsonObject, 'Qualities', this.categoryTranslations);

        const parser = new QualityParserBase();

        let datas: QualityItemData[] = [];
        let jsonDatas = jsonObject['qualities']['quality'];
        for (let i = 0; i < jsonDatas.length; i++) {
            let jsonData = jsonDatas[i];

            if (DataImporter.unsupportedEntry(jsonData)) {
                continue;
            }

            let data = parser.Parse(jsonData, this.GetDefaultData(), this.itemTranslations);

            let category = ImportHelper.StringValue(jsonData, 'category');
            //@ts-ignore TODO: Foundry Where is my foundry base data?
            data.folder = folders[category.toLowerCase()].id;
            data.name = ImportHelper.MapNameToTranslation(this.itemTranslations, data.name);

            datas.push(data);
        }

        // @ts-ignore // TODO: TYPE: Remove this.
        return await Item.create(datas);
    }
}
