sap.ui.define([], function () {
    "use strict";

    const BasicMath = {
        add: function (a, b) {
            return a + b;
        },

        subtract: function (a, b) {
            return a - b;
        },

        multiply: function (a, b) {
            return a * b;
        },

        divide: function (a, b) {
            if (b === 0) {
                throw new Error("Division by zero is not allowed.");
            }
            return a / b;
        }
    };

    return BasicMath;
});