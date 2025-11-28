/**
 * Unified Dynamic FilterBar Delegate
 * -----------------------------------
 * This delegate handles both generic dynamic filters and Timesheet-specific filters.
 * It automatically detects the context and routes to appropriate logic.
 */
sap.ui.define([
    "sap/ui/mdc/FilterBarDelegate",
    "sap/ui/mdc/FilterField",
    "sap/ui/core/Element",
    "csc/ui5lib/delegates/DynamicPropertyInfo",
], function (
    FilterBarDelegate,
    FilterField,
    CoreElement,
    DynamicPropertyInfo,
) {
    "use strict";

    const DynamicFilterBarDelegate = Object.assign({}, FilterBarDelegate);


    // ============================================================================
    // HELPER: Create FilterField
    // ============================================================================
    const _createFilterField = async function(sFilterId, oProp, oFilterBar) {
        const sPropKey = oProp.key;
        const oFilterField = new FilterField(sFilterId, {
            dataType: oProp.dataType,
            conditions: "{$filters>/conditions/" + sPropKey + '}',
            propertyKey: sPropKey,
            required: oProp.required,
            label: oProp.label,
            maxConditions: oProp.maxConditions,
            delegate: {
                name: "sap/ui/mdc/field/FieldBaseDelegate", 
                payload: {}
            }
        });
        return oFilterField;
    };

    // ============================================================================
    // INTERNAL: Create Filter (used by both modes)
    // ============================================================================
    DynamicFilterBarDelegate._createFilter = async function(sPropKey, oFilterBar, mPropBag) {
        const oPayload = oFilterBar.getPayload?.() || oFilterBar.getDelegate()?.payload || {};
        
        // Determine property source based on mode
        const aPropertyInfo =  await DynamicPropertyInfo.fetch(oFilterBar);
        
        const oProp = Array.isArray(aPropertyInfo) 
            ? aPropertyInfo.find((oPI) => oPI.key === sPropKey)
            : null;
        
        if (!oProp) {
            console.warn("Property not found for filter:", sPropKey);
            return null;
        }
        
        const sFilterId = oFilterBar.getId() + "--filter--" + sPropKey;
        
        // Check if filter already exists
        const oExistingFilter = CoreElement.getElementById(sFilterId);
        if (oExistingFilter) {
            return oExistingFilter;
        }
        
        return await _createFilterField(sFilterId, oProp, oFilterBar);
    };

    // ============================================================================
    // PUBLIC API: fetchProperties
    // ============================================================================
    DynamicFilterBarDelegate.fetchProperties = async function(oFilterBar) {
        const oPayload = oFilterBar.getPayload?.() || oFilterBar.getDelegate()?.payload || {};
        
      
        // GENERIC MODE
        return DynamicPropertyInfo.fetch(oFilterBar);
    };

    // ============================================================================
    // PUBLIC API: addItem
    // ============================================================================
    DynamicFilterBarDelegate.addItem = function(oFilterBar, sPropKey, mPropBag) {
        return Promise.resolve(this._createFilter(sPropKey, oFilterBar, mPropBag));
    };

    return DynamicFilterBarDelegate;
});