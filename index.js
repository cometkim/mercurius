'use strict'

const fp = require('fastify-plugin')
const LRU = require('tiny-lru')
const {
  graphql,
  parse,
  buildSchema,
  GraphQLObjectType,
  GraphQLSchema,
  extendSchema,
  buildASTSchema,
  validate,
  validateSchema,
  execute
} = require('graphql')

module.exports = fp(async function (app, opts) {
  const lru = LRU(1000)

  let root = opts.root
  let schema = opts.schema

  if (typeof schema === 'string') {
    schema = buildSchema(schema)
  }

  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    const err = new Error('schema issues')
    err.errors = schemaValidationErrors
    throw err
  }

  app.decorate('graphql', function (source, context, variables) {
    context = Object.assign({ app: this }, context)

    // Parse, with a little lru
    let document = lru.get(source)
    if (!document) {
      try {
        document = parse(source)
        lru.set(source, document)
      } catch (syntaxError) {
        return { errors: [syntaxError] };
      }
    }

    // Validate
    const validationErrors = validate(schema, document);
    if (validationErrors.length > 0) {
      return { errors: validationErrors };
    }

    // Execute
    return execute(
      schema,
      document,
      root,
      context,
      variables
    )
  })
})

