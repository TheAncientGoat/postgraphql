"use strict";
var tslib_1 = require("tslib");
var pluralize = require("pluralize");
var graphql_1 = require("graphql");
var interface_1 = require("../../../interface");
var utils_1 = require("../../../graphql/utils");
var createMutationGqlField_1 = require("../../../graphql/schema/createMutationGqlField");
var createCollectionRelationTailGqlFieldEntries_1 = require("../../../graphql/schema/collection/createCollectionRelationTailGqlFieldEntries");
var utils_2 = require("../../../postgres/utils");
var PgCollection_1 = require("../../../postgres/inventory/collection/PgCollection");
var pgClientFromContext_1 = require("../../../postgres/inventory/pgClientFromContext");
var createPgProcedureFixtures_1 = require("./createPgProcedureFixtures");
var createPgProcedureSqlCall_1 = require("./createPgProcedureSqlCall");
var createConnectionGqlField_1 = require("../../../graphql/schema/connection/createConnectionGqlField");
var getSelectFragment_1 = require("../../../postgres/inventory/paginator/getSelectFragment");
/**
 * Creates a single mutation GraphQL field entry for our procedure. We use the
 * `createMutationGqlField` utility from the `graphql` package to do so.
 */
// TODO: test
function createPgProcedureMutationGqlFieldEntry(buildToken, pgCatalog, pgProcedure) {
    var inventory = buildToken.inventory;
    var fixtures = createPgProcedureFixtures_1.default(buildToken, pgCatalog, pgProcedure);
    // See if the output type of this procedure is a single object, try to find a
    // `PgCollection` which has the same type. If it exists we add some extra
    // stuffs.
    var pgCollection = !pgProcedure.returnsSet
        ? inventory.getCollections().find(function (collection) { return collection instanceof PgCollection_1.default && collection.pgClass.typeId === fixtures.return.pgType.id; })
        : null;
    // Create our GraphQL input fields users will use to input data into our
    // procedure.
    var inputFields = fixtures.args.map(function (_a) {
        var name = _a.name, gqlType = _a.gqlType;
        return [utils_1.formatName.field(name), {
                // No description…
                type: pgProcedure.isStrict ? new graphql_1.GraphQLNonNull(graphql_1.getNullableType(gqlType)) : gqlType,
            }];
    });
    return [utils_1.formatName.field(pgProcedure.name), createMutationGqlField_1.default(buildToken, {
            name: pgProcedure.name,
            description: pgProcedure.description,
            relatedGqlType: fixtures.return.gqlType,
            inputFields: inputFields,
            outputFields: [
                [utils_1.formatName.field(pgProcedure.returnsSet
                        ? pluralize(getTypeFieldName(fixtures.return.type))
                        : getTypeFieldName(fixtures.return.type)), {
                        // If we are returning a set, we should wrap our type in a GraphQL
                        // list.
                        type: pgProcedure.returnsSet
                            ? new graphql_1.GraphQLList(fixtures.return.gqlType)
                            : fixtures.return.gqlType,
                        resolve: function (value) { return fixtures.return.intoGqlOutput(value); },
                    }],
                // An edge variant of the created value. Because we use cursor
                // based pagination, it is also helpful to get the cursor for the
                // value we just created (thus why this is in the form of an edge).
                // Also Relay 1 requires us to return the edge.
                //
                // We may deprecate this in the future if Relay 2 doesn’t need it.
                pgCollection && pgCollection.paginator && [utils_1.formatName.field(pgCollection.type.name + "-edge"), {
                        description: "An edge for the type. May be used by Relay 1.",
                        type: createConnectionGqlField_1.getEdgeGqlType(buildToken, pgCollection.paginator),
                        args: { orderBy: createConnectionGqlField_1.createOrderByGqlArg(buildToken, pgCollection.paginator) },
                        resolve: function (value, args) { return ({
                            paginator: pgCollection.paginator,
                            ordering: args['orderBy'],
                            cursor: null,
                            value: value,
                        }); },
                    }]
            ].concat((pgCollection ? createCollectionRelationTailGqlFieldEntries_1.default(buildToken, pgCollection, { getCollectionValue: function (value) { return value; } }) : [])),
            // Actually execute the procedure here.
            execute: function (context, gqlInput, resolveInfo) {
                return tslib_1.__awaiter(this, void 0, void 0, function () {
                    var client, input, procedureCall, aliasIdentifier, query, rows, values, _a;
                    return tslib_1.__generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                client = pgClientFromContext_1.default(context);
                                input = inputFields.map(function (_a, i) {
                                    var fieldName = _a[0];
                                    return fixtures.args[i].fromGqlInput(gqlInput[fieldName]);
                                });
                                procedureCall = createPgProcedureSqlCall_1.default(fixtures, input);
                                aliasIdentifier = Symbol();
                                query = utils_2.sql.compile((_a = ["\n          select ", " as value\n          from ", " as ", "\n        "], _a.raw = ["\n          select ", " as value\n          from ", " as ", "\n        "], utils_2.sql.query(_a, getSelectFragment_1.default(resolveInfo, aliasIdentifier, fixtures.return.gqlType), procedureCall, utils_2.sql.identifier(aliasIdentifier))));
                                return [4 /*yield*/, client.query(query)];
                            case 1:
                                rows = (_b.sent()).rows;
                                values = rows.map(function (_a) {
                                    var value = _a.value;
                                    return fixtures.return.type.transformPgValueIntoValue(value);
                                });
                                // If we selected a set of values, return the full set. Otherwise only
                                // return the one we queried.
                                return [2 /*return*/, pgProcedure.returnsSet ? values : values[0]];
                        }
                    });
                });
            },
        })];
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createPgProcedureMutationGqlFieldEntry;
/**
 * Gets the field name for any given type. Pluralizes the name of for item
 * types in list types.
 */
function getTypeFieldName(_type) {
    return interface_1.switchType(_type, {
        nullable: function (type) { return getTypeFieldName(type.nonNullType); },
        list: function (type) { return pluralize(getTypeFieldName(type.itemType)); },
        alias: function (type) { return type.name; },
        enum: function (type) { return type.name; },
        object: function (type) { return type.name; },
        scalar: function (type) { return type.name; },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlUGdQcm9jZWR1cmVNdXRhdGlvbkdxbEZpZWxkRW50cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcG9zdGdyYXBocWwvc2NoZW1hL3Byb2NlZHVyZXMvY3JlYXRlUGdQcm9jZWR1cmVNdXRhdGlvbkdxbEZpZWxkRW50cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxQ0FBdUM7QUFDdkMsbUNBTWdCO0FBQ2hCLGdEQUFxRDtBQUNyRCxnREFBbUQ7QUFFbkQseUZBQW1GO0FBQ25GLDhJQUF3STtBQUN4SSxpREFBNkM7QUFFN0Msb0ZBQThFO0FBQzlFLHVGQUFpRjtBQUNqRix5RUFBbUU7QUFDbkUsdUVBQWlFO0FBQ2pFLHdHQUFpSDtBQUNqSCw2RkFBdUY7QUFFdkY7OztHQUdHO0FBQ0gsYUFBYTtBQUNiLGdEQUNFLFVBQXNCLEVBQ3RCLFNBQW9CLEVBQ3BCLFdBQStCO0lBRXZCLElBQUEsZ0NBQVMsQ0FBZTtJQUNoQyxJQUFNLFFBQVEsR0FBRyxtQ0FBeUIsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFBO0lBRTlFLDZFQUE2RTtJQUM3RSx5RUFBeUU7SUFDekUsVUFBVTtJQUNWLElBQU0sWUFBWSxHQUFHLENBQUMsV0FBVyxDQUFDLFVBQVU7VUFDeEMsU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFBLFVBQVUsSUFBSSxPQUFBLFVBQVUsWUFBWSxzQkFBWSxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBN0YsQ0FBNkYsQ0FBQztVQUM1SSxJQUFJLENBQUE7SUFFUix3RUFBd0U7SUFDeEUsYUFBYTtJQUNiLElBQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUNuQyxVQUFDLEVBQWlCO1lBQWYsY0FBSSxFQUFFLG9CQUFPO1FBQ2QsT0FB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