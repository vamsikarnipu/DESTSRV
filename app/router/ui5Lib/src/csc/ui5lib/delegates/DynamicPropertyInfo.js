/**
 * Dynamic ValueHelp Property Info
 * -------------------------------
 * Helper module that dynamically builds property info arrays for any OData V4 entity set OR JSON model.
 */

sap.ui.define([
    "csc/ui5lib/delegates/helper/PayloadParser",
    "csc/ui5lib/delegates/helper/DataTypeMapper"
], function (
    PayloadParser,
    DataTypeMapper
) {
    "use strict";

    const _ = {
        /**
         * Get model from control, component registry, or core
         */
        getModelByName: (oControl, sModelName) => {
            // Try control first
            if (oControl?.getModel) {
                const oModel = oControl.getModel(sModelName);
                if (oModel) {
                    return oModel;
                }
            }

            // Try component registry
            try {
                const aComps = Object.values(sap.ui.core.Component.registry.all());
                for (const c of aComps) {
                    if (c) {
                        const m = c.getModel(sModelName) || (sModelName === "" ? c.getModel() : null);
                        if (m) {
                            return m;
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }

            // Fallback to core
            const oModel = sap.ui.getCore().getModel(sModelName) || (sModelName === "" ? sap.ui.getCore().getModel() : null);
            if (oModel) {
            } else {
                console.warn("❌ Model not found:", sModelName);
            }

            return oModel;
        },

        /**
         * Unified property info builder for both OData and JSON models
         */
        buildPropertyInfo: async (oControl, oModel, sModelName, oPayload) => {
            const sModelType = oModel.getMetadata().getName();
            const bIsODataV4 = sModelType === "sap.ui.model.odata.v4.ODataModel";
            const bIsJSONModel = sModelType === "sap.ui.model.json.JSONModel";


            // OData V4 - use metadata
            if (bIsODataV4 && oPayload.entityName) {
                return await _.buildFromODataMetadata(oModel, oPayload.entityName);
            }

            // JSON Model or fallback - infer from data
            const sPath = oPayload.collectionPath || oPayload.bindingPath || "/items";
            return _.buildFromJsonData(oModel, sPath);
        },

        /**
         * Build property info from OData metadata
         */
        buildFromODataMetadata: async (oModel, sEntitySet) => {
            try {
                await oModel.getMetaModel().requestObject(`/${sEntitySet}`);
            } catch (err) {
                console.error("❌ Failed to load OData metadata:", err);
                return [];
            }

            const oMetaModel = oModel.getMetaModel();
            const oEntitySet = oMetaModel.getObject(`/${sEntitySet}`);
            if (!oEntitySet) return [];

            const oEntityType = oMetaModel.getObject("/" + oEntitySet.$Type);
            if (!oEntityType) return [];

            const aProperties = Object.entries(oEntityType)
                .filter(([, value]) => value?.$kind === "Property");

            return aProperties.map(([sKey, oPropDef]) => ({
                key: sKey,
                path: sKey,
                name: sKey,
                label: sKey,
                dataType: DataTypeMapper.getUI5Type(oPropDef.$Type),
            }));
        },

        /**
         * Build property info from actual data (JSON model or fallback)
         */
        buildFromJsonData: (oModel, sPath) => {

            // Normalize path
            let sDataPath = sPath;
            if (sPath?.includes('>')) {
                sDataPath = sPath.split('>')[1];
            }
            if (sDataPath && !sDataPath.startsWith('/')) {
                sDataPath = '/' + sDataPath;
            }

            const oData = oModel.getProperty(sDataPath);

            if (!oData) {
                console.warn("❌ No data found at path:", sDataPath);
                return [];
            }

            // Normalize to array
            const aSampleData = Array.isArray(oData) ? oData : [oData];

            if (aSampleData.length === 0) {
                console.warn("⚠️ Empty data array");
                return [];
            }

            const oSampleItem = aSampleData[0];


            return Object.keys(oSampleItem)
                .filter(sKey => {
                    // Ignore keys starting with @ or _
                    if (sKey.startsWith('@') || sKey.startsWith('_')) {

                        return false;
                    }

                    const value = oSampleItem[sKey];

                    // Ignore objects (but allow Date objects)
                    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                        return false;
                    }

                    return true;
                })
                .map(sKey => ({
                    key: sKey,
                    path: sKey,
                    name: sKey,
                    label: _.formatLabel(sKey),
                    dataType: _.inferDataType(oSampleItem[sKey]),

                }));

        },

        /**
         * Infer UI5 data type from JavaScript value
         */
        inferDataType: (value) => {
            if (typeof value === 'number') {
                return Number.isInteger(value) ?
                    "sap.ui.model.type.Integer" :
                    "sap.ui.model.type.Float";
            }
            if (typeof value === 'boolean') {
                return "sap.ui.model.type.Boolean";
            }
            if (value instanceof Date) {
                return "sap.ui.model.type.Date";
            }
            return "sap.ui.model.type.String";
        },

        /**
         * Convert camelCase/PascalCase to Title Case
         */
        formatLabel: (sKey) => {
            return sKey
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
        }
    };

    const DynamicPropertyInfo = {
        /**
         * Fetch property info dynamically for any entity set or JSON model
         * @param {sap.ui.mdc.Table|sap.ui.mdc.FilterBar} oControl - The control requesting property info
         * @returns {Promise<Array>} Property info array
         */
        fetch: async (oControl) => {
            try {
                const oPayload = PayloadParser.parse(oControl);

                // Use predefined property info if available
                if (oPayload?.propertyInfo?.length) {
                    return oPayload.propertyInfo;
                }

                const sModelName = oPayload.modelName || "";
                const oModel = _.getModelByName(oControl, sModelName);

                if (!oModel) {
                    console.warn("❌ Model not found:", sModelName);
                    return [];
                }


                const oProperties = await _.buildPropertyInfo(oControl, oModel, sModelName, oPayload);

                if (oProperties?.length > 0) {
                    oPayload.propertyInfo = oProperties;
                } else {
                    console.warn("⚠️ No properties found");
                }

                return oProperties || [];

            } catch (err) {
                console.error("❌ DynamicPropertyInfo.fetch error:", err);
                return [];
            }
        }
    };

    return DynamicPropertyInfo;
});