/**
 * @fileoverview restrict values that can be used as Promise rejection reasons
 * @author Teddy Katz
 */
"use strict";

const astUtils = require("../ast-utils");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
    meta: {
        docs: {
            description: "disallow using literals as Promise rejection reasons",
            category: "Best Practices",
            recommended: false
        },
        fixable: null,
        schema: []
    },

    create(context) {

        //----------------------------------------------------------------------
        // Helpers
        //----------------------------------------------------------------------

        /**
        * Checks the argument of a reject() or Promise.reject() CallExpression, and reports it if it can't be an Error
        * @param {ASTNode} callExpression A CallExpression node which is used to reject a Promise
        * @returns {void}
        */
        function checkRejectedLiteral(callExpression) {
            if (
                !callExpression.arguments.length ||
                !astUtils.couldBeError(callExpression.arguments[0]) ||
                callExpression.arguments[0].type === "Identifier" && callExpression.arguments[0].name === "undefined"
            ) {
                context.report({
                    node: callExpression,
                    message: "Expected the Promise rejection reason to be an Error."
                });
            }
        }

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        return {

            // Check `Promise.reject(value)` calls.
            CallExpression(node) {
                if (
                    node.callee.type === "MemberExpression" &&
                    node.callee.object.type === "Identifier" && node.callee.object.name === "Promise" &&
                    node.callee.property.type === "Identifier" && node.callee.property.name === "reject"
                ) {
                    checkRejectedLiteral(node);
                }
            },

            /*
             * Check for `new Promise((resolve, reject) => {})`, and check for reject() calls.
             * This function is run on "NewExpression:exit" instead of "NewExpression" to ensure that
             * the nodes in the expression already have the `parent` property.
             */
            "NewExpression:exit"(node) {
                if (
                    node.callee.type === "Identifier" && node.callee.name === "Promise" &&
                    node.arguments.length && astUtils.isFunction(node.arguments[0]) &&
                    node.arguments[0].params.length > 1 && node.arguments[0].params[1].type === "Identifier"
                ) {
                    context.getDeclaredVariables(node.arguments[0])

                        /*
                        * Find the first variable that matches the second parameter's name.
                        * If the first parameter has the same name as the second parameter, then the variable will actually
                        * be "declared" when the first parameter is evaluated, but then it will be immediately overwritten
                        * by the second parameter. It's not possible for an expression with the variable to be evaluated before
                        * the variable is overwritten, because functions with duplicate parameters cannot have destructuring or
                        * default assignments in their parameter lists. Therefore, it's not necessary to explicitly account for
                        * this case.
                        */
                        .find(variable => variable.name === node.arguments[0].params[1].name)

                        // Get the references to that variable.
                        .references

                        // Only check the references that read the parameter's value.
                        .filter(ref => ref.isRead())

                        // Only check the references that are used as the callee in a function call, e.g. `reject(foo)`.
                        .filter(ref => ref.identifier.parent.type === "CallExpression" && ref.identifier === ref.identifier.parent.callee)

                        // Check the argument of the function call to determine whether it's a literal.
                        .forEach(ref => checkRejectedLiteral(ref.identifier.parent));
                }
            }
        };
    }
};