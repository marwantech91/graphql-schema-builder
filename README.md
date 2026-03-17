# GraphQL Schema Builder

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![GraphQL](https://img.shields.io/badge/GraphQL-16+-E10098?style=flat-square&logo=graphql)

Programmatic GraphQL schema builder with a fluent API. Define types, queries, mutations, and enums without writing SDL strings.

## Features

- Fluent builder API
- Object types and input types
- Enum support
- Query and mutation definitions
- Nested type resolution
- List and non-null modifiers
- Works with any GraphQL server (Apollo, Express GraphQL, etc.)

## Usage

```typescript
import { createSchema } from '@marwantech/graphql-schema-builder';

const schema = createSchema()
  .type('User', {
    id: { type: 'ID', required: true },
    name: 'String',
    email: { type: 'String', required: true },
    posts: { type: 'Post', list: true },
  })
  .type('Post', {
    id: { type: 'ID', required: true },
    title: 'String',
    content: 'String',
  })
  .input('CreateUserInput', {
    name: { type: 'String', required: true },
    email: { type: 'String', required: true },
  })
  .query('user', {
    type: 'User',
    args: { id: { type: 'ID', required: true } },
    resolve: (_, { id }) => getUserById(id),
  })
  .mutation('createUser', {
    type: 'User',
    required: true,
    args: { input: { type: 'CreateUserInput', required: true } },
    resolve: (_, { input }) => createUser(input),
  })
  .build();
```

## License

MIT
