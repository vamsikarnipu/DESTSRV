sap.ui.define([
    "sap/ui/core/Element",
    "sap/ui/mdc/TableDelegate",
    "sap/ui/mdc/FilterField",
    "sap/ui/mdc/enums/TableType",
    "sap/m/plugins/PluginBase",
    "sap/m/plugins/CopyProvider",
    "csc/ui5lib/delegates/DynamicPropertyInfo"
], function (
    Element,
    TableDelegate,
    FilterField,
    TableType,
    PluginBase,
    CopyProvider,
    DynamicPropertyInfo
) {
    "use strict";

    const DynamicTableDelegate = Object.assign({}, TableDelegate);

    // ============================================================================
    // PUBLIC API: fetchProperties
    // ============================================================================
    DynamicTableDelegate.fetchProperties = async function (oTable) {
        const oDynamicPropsPromise = DynamicPropertyInfo.fetch(oTable);
        return Promise.resolve(oDynamicPropsPromise);
    };

    // ============================================================================
    // PUBLIC API: addItem
    // ============================================================================
    DynamicTableDelegate.addItem = async function (oTable, sPropertyKey) {
        const oPayload = oTable.getPayload() || {};
        const aProps = await this.fetchProperties(oTable);
        const oPropertyInfo = aProps.find(p => p.key === sPropertyKey);
        if (!oPropertyInfo) {
            console.warn("Property not found:", sPropertyKey);
            return null;
        }
        const sId = `${oTable.getId()}---col-${sPropertyKey}`;
        // Determine binding path from payload
        const sModelName = oPayload.modelName || "";
        let sBindingPath;
        if (oPayload.bindingPath) {
            // Extract model name from bindingPath if it contains ">"
            if (oPayload.bindingPath.includes(">")) {
                const sBindingModel = oPayload.bindingPath.split(">")[0];
                sBindingPath = `${sBindingModel}>${oPropertyInfo.path}`;
            } else {
                sBindingPath = sModelName ? `${sModelName}>${oPropertyInfo.path}` : oPropertyInfo.path;
            }
        } else {
            sBindingPath = sModelName ? `${sModelName}>${oPropertyInfo.path}` : oPropertyInfo.path;
        }
        return new sap.ui.mdc.table.Column(sId, {
            propertyKey: oPropertyInfo.key,
            header: oPropertyInfo.label,
            template: new sap.m.Text({
                text: `{${sBindingPath}}`
            }),
            width: "15%"
        });
    };

    // ============================================================================
    // PUBLIC API: getFilterDelegate
    // ============================================================================
    DynamicTableDelegate.getFilterDelegate = function () {
        return {
            addItem: function (oProperty) {
                const oFilterField = new FilterField({
                    dataType: oProperty.dataType,
                    conditions: `{$filters>/conditions/${oProperty.key}}`,
                    propertyKey: oProperty.key,
                    label: oProperty.label,
                    maxConditions: -1
                });
                return Promise.resolve(oFilterField);
            },
            removeItem: function (oFilterField) {
                if (oFilterField) {
                    oFilterField.destroy();
                }
                return Promise.resolve(true);
            }
        };
    };

    // ============================================================================
    // PUBLIC API: updateBindingInfo
    // ============================================================================
    DynamicTableDelegate.updateBindingInfo = function (oTable, oBindingInfo) {
        // Call the base class's updateBindingInfo method
        TableDelegate.updateBindingInfo.apply(this, arguments);
        // Retrieve the payload from the table or its delegate
        const oPayload = oTable.getPayload?.() || oTable.getDelegate()?.payload || {};
        // Use bindingPath if provided, otherwise derive from collectionPath
        if (oPayload.bindingPath) {
            oBindingInfo.path = oPayload.bindingPath; // Set binding path from payload
        } else if (oPayload.collectionPath) {
            oBindingInfo.path = oPayload.collectionPath; // Fallback to collection path
        }
        // Ensure model is set for items model
        oBindingInfo.model = oBindingInfo.model || "items";
        // Initialize actions array for buttons and controls
        const aActions = [];
        //==========Copy Features==================   
        if (oTable.getSelectionMode() !== "SingleMaster") {
            oTable.setCopyProvider(CopyProvider);
        }
        if (oPayload?.tableModeType === "ValueHelp") {
            oTable.destroyVariant(); // Destroy variant for ValueHelp mode
            oTable.setEnableExport(false); // Disable export functionality
            oTable.setP13nMode([]); // ❌ No personalization (Column, Sort, Group)
        }
        else {
            oTable.setP13nMode(["Column", "Sort", "Group"]);
            // Add a segmented button for row display options
            const aExistingActions = oTable.getActions();
            const getSegDetail = aExistingActions.filter(action =>
                action.getId().includes("SegmentedButton-showDetails")
            );
            this.oTable = oTable;
            const sTableId = oTable.getId();
            const sSegmentedButtonId = sTableId + "-SegmentedButton-showDetails";
            if (getSegDetail?.length === 0) {
                aActions.push(
                    new sap.m.SegmentedButton({
                        id: sSegmentedButtonId,
                        selectedKey: "less",
                        items: [
                            new sap.m.SegmentedButtonItem({
                                key: "more",
                                icon: "sap-icon://detail-more",
                                tooltip: "Show more per row"
                            }),
                            new sap.m.SegmentedButtonItem({
                                key: "less",
                                icon: "sap-icon://detail-less",
                                tooltip: "Show less per row"
                            }),
                        ],
                        // Event handler for segmented button selection
                        select: function (oEvent) {
                            const sKey = oEvent.getParameter("key");
                            const oSource = oEvent.getSource();
                            // 🔹 Get the table instance safely (the parent of the toolbar)
                            let oTable = oSource.getParent();
                            // If not found directly, try walking up the control hierarchy
                            while (oTable && !oTable.isA("sap.ui.mdc.Table")) {
                                oTable = oTable.getParent();
                            }

                            // ✅ Apply show/hide class logic
                            if (sKey === "more") {
                                oTable.removeStyleClass("show-less");
                            } else {
                                oTable.addStyleClass("show-less");
                            }
                        }
                    })
                );
            }
            oTable.setEnableExport(true);
        }
        // Add all actions to the table
        aActions.forEach(action => {
            oTable.addAction(action);
        });
        // Parse payload for additional binding information
        const PayloadParser = sap.ui.require("sap/btp/apps/timesheet/csc/helper/PayloadParser");
        const oParsedPayload = PayloadParser ? PayloadParser.parse(oTable) : oPayload;
        // Retrieve the filter control and search text
        const oFilterCtrl = Element.getElementById(oTable.getFilter?.());
        const sSearch = oFilterCtrl?.getSearch?.() || "";
        const aCols = oTable.getColumns?.().map(c => c.getPropertyKey()) || []; // Get column property keys
        // Set binding information path and model
        oBindingInfo.path = oBindingInfo.path ||
            oParsedPayload.collectionPath ||
            "/" + oParsedPayload.collectionName;
        oBindingInfo.model = oBindingInfo.model || oParsedPayload.model;
        // Initialize binding parameters
        oBindingInfo.parameters = oBindingInfo.parameters || {};
        // Set search parameter if search text exists
        if (sSearch) {
            oBindingInfo.parameters.$search = sSearch;
        } else if (oBindingInfo.parameters.$search) {

            delete oBindingInfo.parameters.$search; // Remove search parameter if empty
        }
        oBindingInfo.parameters.$count = true; // Enable count parameter
        // Handle dependent filters based on selected value
        const sSelectedValue = oTable.data("SelectedValue");
        const sFilterField = oParsedPayload.filterField;
        if (sSelectedValue && sFilterField) {
            const oDependentFilter = new sap.ui.model.Filter(
                sFilterField,
                sap.ui.model.FilterOperator.EQ,
                sSelectedValue
            );
            const aExisting = oBindingInfo.filters
                ? (oBindingInfo.filters instanceof sap.ui.model.Filter ?
                    [oBindingInfo.filters] : oBindingInfo.filters)
                : [];
            // Add the dependent filter to the existing filters
            oBindingInfo.filters = aExisting.length
                ? new sap.ui.model.Filter([...aExisting, oDependentFilter], true)
                : oDependentFilter;
        }
        // If columns exist, set the select parameter
        if (aCols.length) {
            oBindingInfo.parameters.$select = aCols.join(",");
        }
    };
    DynamicTableDelegate.getFilters = function () {
        return TableDelegate.getFilters.apply(this, arguments);
    };
    // ============================================================================
    // PUBLIC API: setSelectedContexts
    // ============================================================================
    DynamicTableDelegate.setSelectedContexts = function (oTable, aContexts) {
        if (oTable._isOfType(TableType.Table, true)) {
            const oMultiSelectionPlugin = PluginBase.getPlugin(
                oTable._oTable,
                "sap.ui.table.plugins.MultiSelectionPlugin"
            );
            if (oMultiSelectionPlugin) {
                oMultiSelectionPlugin.clearSelection();
                const oRowBinding = oTable.getRowBinding();
                const aAllCurrentContexts = oRowBinding?.getAllCurrentContexts?.() ||
                    oRowBinding?.getContexts?.();
                return aContexts.map(oContext => {
                    const iContextIndex = aAllCurrentContexts.indexOf(oContext);
                    return oMultiSelectionPlugin.addSelectionInterval(iContextIndex, iContextIndex);
                });
            }
        } else {
            TableDelegate.setSelectedContexts.apply(this, arguments);
        }
    };
    return DynamicTableDelegate;
});