import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  printSchema,
} from 'graphql';
import SchemaBuilder, { createSchema, isScalarType } from '../index';

describe('SchemaBuilder', () => {
  let builder: SchemaBuilder;

  beforeEach(() => {
    builder = new SchemaBuilder();
  });

  // --- Creating types with fields ---

  describe('type()', () => {
    it('should register a type with shorthand scalar fields', () => {
      builder.type('User', {
        id: 'ID',
        name: 'String',
        age: 'Int',
      });

      builder.query('user', {
        type: 'User',
        resolve: () => ({ id: '1', name: 'Alice', age: 30 }),
      });

      const schema = builder.build();
      const userType = schema.getType('User') as GraphQLObjectType;

      expect(userType).toBeDefined();
      expect(userType.name).toBe('User');

      const fields = userType.getFields();
      expect(fields.id).toBeDefined();
      expect(fields.name).toBeDefined();
      expect(fields.age).toBeDefined();
    });

    it('should register a type with full field definitions', () => {
      builder.type('Post', {
        id: { type: 'ID', required: true },
        title: { type: 'String', description: 'The post title' },
        score: { type: 'Float' },
        published: { type: 'Boolean' },
      });

      builder.query('post', {
        type: 'Post',
        resolve: () => null,
      });

      const schema = builder.build();
      const postType = schema.getType('Post') as GraphQLObjectType;
      const fields = postType.getFields();

      expect(fields.id.type).toBeInstanceOf(GraphQLNonNull);
      expect(fields.title.description).toBe('The post title');
      expect(fields.score).toBeDefined();
      expect(fields.published).toBeDefined();
    });

    it('should support type descriptions', () => {
      builder.type('Tag', { name: 'String' }, 'A content tag');
      builder.query('tag', { type: 'Tag', resolve: () => null });

      const schema = builder.build();
      const tagType = schema.getType('Tag') as GraphQLObjectType;
      expect(tagType.description).toBe('A content tag');
    });

    it('should support references to other custom types', () => {
      builder.type('Author', { name: 'String' });
      builder.type('Book', {
        title: 'String',
        author: { type: 'Author' },
      });

      builder.query('book', { type: 'Book', resolve: () => null });

      const schema = builder.build();
      const bookType = schema.getType('Book') as GraphQLObjectType;
      const authorField = bookType.getFields().author;
      expect((authorField.type as GraphQLObjectType).name).toBe('Author');
    });
  });

  // --- Creating input types ---

  describe('input()', () => {
    it('should register an input type', () => {
      builder.input('CreateUserInput', {
        name: { type: 'String', required: true },
        email: 'String',
      });

      builder.type('User', { id: 'ID', name: 'String' });

      builder.mutation('createUser', {
        type: 'User',
        args: {
          input: { type: 'CreateUserInput', required: true },
        },
        resolve: (_: any, args: any) => ({ id: '1', name: args.input.name }),
      });

      const schema = builder.build();
      const inputType = schema.getType('CreateUserInput') as GraphQLInputObjectType;

      expect(inputType).toBeDefined();
      expect(inputType).toBeInstanceOf(GraphQLInputObjectType);

      const fields = inputType.getFields();
      expect(fields.name).toBeDefined();
      expect(fields.name.type).toBeInstanceOf(GraphQLNonNull);
      expect(fields.email).toBeDefined();
    });

    it('should support input type descriptions', () => {
      builder.input('FilterInput', { keyword: 'String' }, 'Search filter');
      builder.type('Result', { id: 'ID' });
      builder.query('search', {
        type: 'Result',
        args: { filter: { type: 'FilterInput' } },
        resolve: () => null,
      });

      const schema = builder.build();
      const inputType = schema.getType('FilterInput') as GraphQLInputObjectType;
      expect(inputType.description).toBe('Search filter');
    });
  });

  // --- Creating enums ---

  describe('enum()', () => {
    it('should register an enum type', () => {
      builder.enum('Status', {
        ACTIVE: { value: 'active', description: 'Currently active' },
        INACTIVE: { value: 'inactive' },
        PENDING: undefined,
      });

      builder.type('User', { status: { type: 'Status' } });
      builder.query('user', { type: 'User', resolve: () => null });

      const schema = builder.build();
      const enumType = schema.getType('Status') as GraphQLEnumType;

      expect(enumType).toBeDefined();
      expect(enumType).toBeInstanceOf(GraphQLEnumType);

      const values = enumType.getValues();
      expect(values).toHaveLength(3);

      const activeVal = values.find(v => v.name === 'ACTIVE');
      expect(activeVal?.value).toBe('active');
      expect(activeVal?.description).toBe('Currently active');
    });

    it('should support enum descriptions', () => {
      builder.enum('Priority', {
        LOW: undefined,
        HIGH: undefined,
      }, 'Task priority levels');

      builder.type('Task', { priority: { type: 'Priority' } });
      builder.query('task', { type: 'Task', resolve: () => null });

      const schema = builder.build();
      const enumType = schema.getType('Priority') as GraphQLEnumType;
      expect(enumType.description).toBe('Task priority levels');
    });

    it('should allow enums as query return types', () => {
      builder.enum('Color', {
        RED: { value: 'red' },
        BLUE: { value: 'blue' },
      });

      builder.query('favoriteColor', {
        type: 'Color',
        resolve: () => 'red',
      });

      const schema = builder.build();
      expect(schema.getQueryType()).toBeDefined();
    });
  });

  // --- Building queries ---

  describe('query()', () => {
    it('should build a schema with queries', () => {
      builder.query('hello', {
        type: 'String',
        resolve: () => 'world',
      });

      const schema = builder.build();
      const queryType = schema.getQueryType();

      expect(queryType).toBeDefined();
      expect(queryType!.name).toBe('Query');

      const fields = queryType!.getFields();
      expect(fields.hello).toBeDefined();
    });

    it('should support query arguments', () => {
      builder.query('greet', {
        type: 'String',
        args: {
          name: { type: 'String', required: true },
        },
        resolve: (_: any, args: any) => `Hello ${args.name}`,
      });

      const schema = builder.build();
      const fields = schema.getQueryType()!.getFields();
      const greetArgs = fields.greet.args;

      expect(greetArgs).toHaveLength(1);
      expect(greetArgs[0].name).toBe('name');
      expect(greetArgs[0].type).toBeInstanceOf(GraphQLNonNull);
    });

    it('should support query argument default values', () => {
      builder.query('items', {
        type: 'String',
        args: {
          limit: { type: 'Int', defaultValue: 10, description: 'Max items' },
        },
        resolve: () => 'ok',
      });

      const schema = builder.build();
      const args = schema.getQueryType()!.getFields().items.args;
      expect(args[0].defaultValue).toBe(10);
      expect(args[0].description).toBe('Max items');
    });

    it('should support query descriptions', () => {
      builder.query('ping', {
        type: 'String',
        description: 'Health check endpoint',
        resolve: () => 'pong',
      });

      const schema = builder.build();
      const field = schema.getQueryType()!.getFields().ping;
      expect(field.description).toBe('Health check endpoint');
    });
  });

  // --- Building mutations ---

  describe('mutation()', () => {
    it('should build a schema with mutations', () => {
      builder.type('User', { id: 'ID', name: 'String' });

      builder.mutation('createUser', {
        type: 'User',
        args: {
          name: { type: 'String', required: true },
        },
        resolve: (_: any, args: any) => ({ id: '1', name: args.name }),
      });

      // Need at least a query for a valid schema
      builder.query('placeholder', { type: 'String', resolve: () => '' });

      const schema = builder.build();
      const mutationType = schema.getMutationType();

      expect(mutationType).toBeDefined();
      expect(mutationType!.name).toBe('Mutation');

      const fields = mutationType!.getFields();
      expect(fields.createUser).toBeDefined();
    });

    it('should support mutations without queries', () => {
      builder.mutation('doSomething', {
        type: 'Boolean',
        resolve: () => true,
      });

      const schema = builder.build();
      expect(schema.getMutationType()).toBeDefined();
      expect(schema.getQueryType()).toBeUndefined();
    });
  });

  // --- Full schema ---

  describe('build()', () => {
    it('should build a complete schema with types, enums, queries, and mutations', () => {
      builder
        .enum('Role', {
          ADMIN: { value: 'admin' },
          USER: { value: 'user' },
        })
        .type('User', {
          id: { type: 'ID', required: true },
          name: 'String',
          role: { type: 'Role' },
        })
        .input('CreateUserInput', {
          name: { type: 'String', required: true },
          role: { type: 'Role' },
        })
        .query('users', {
          type: 'User',
          list: true,
          resolve: () => [],
        })
        .query('user', {
          type: 'User',
          args: { id: { type: 'ID', required: true } },
          resolve: () => null,
        })
        .mutation('createUser', {
          type: 'User',
          args: { input: { type: 'CreateUserInput', required: true } },
          resolve: () => null,
        });

      const schema = builder.build();

      expect(schema).toBeInstanceOf(GraphQLSchema);
      expect(schema.getQueryType()).toBeDefined();
      expect(schema.getMutationType()).toBeDefined();
      expect(schema.getType('User')).toBeDefined();
      expect(schema.getType('Role')).toBeInstanceOf(GraphQLEnumType);
      expect(schema.getType('CreateUserInput')).toBeInstanceOf(GraphQLInputObjectType);
    });

    it('should produce a valid printable schema', () => {
      builder
        .type('Item', { id: 'ID', label: 'String' })
        .query('items', {
          type: 'Item',
          list: true,
          resolve: () => [],
        });

      const schema = builder.build();
      const printed = printSchema(schema);

      expect(printed).toContain('type Query');
      expect(printed).toContain('type Item');
      expect(printed).toContain('items');
    });

    it('should throw for unknown output types', () => {
      builder.query('broken', {
        type: 'NonExistentType',
        resolve: () => null,
      });

      expect(() => builder.build()).toThrow('Unknown type: NonExistentType');
    });

    it('should throw for unknown input types', () => {
      builder.query('broken', {
        type: 'String',
        args: {
          input: { type: 'NonExistentInput', required: true },
        },
        resolve: () => null,
      });

      expect(() => builder.build()).toThrow('Unknown input type: NonExistentInput');
    });
  });

  // --- isScalarType helper ---

  describe('isScalarType()', () => {
    it('should return true for all GraphQL scalar types', () => {
      expect(isScalarType('String')).toBe(true);
      expect(isScalarType('Int')).toBe(true);
      expect(isScalarType('Float')).toBe(true);
      expect(isScalarType('Boolean')).toBe(true);
      expect(isScalarType('ID')).toBe(true);
    });

    it('should return false for non-scalar type names', () => {
      expect(isScalarType('User')).toBe(false);
      expect(isScalarType('string')).toBe(false);
      expect(isScalarType('')).toBe(false);
      expect(isScalarType('Object')).toBe(false);
    });
  });

  // --- Required/list field modifiers ---

  describe('field modifiers', () => {
    it('should wrap required fields in GraphQLNonNull', () => {
      builder.type('Thing', {
        name: { type: 'String', required: true },
      });
      builder.query('thing', { type: 'Thing', resolve: () => null });

      const schema = builder.build();
      const thingType = schema.getType('Thing') as GraphQLObjectType;
      const nameField = thingType.getFields().name;

      expect(nameField.type).toBeInstanceOf(GraphQLNonNull);
    });

    it('should wrap list fields in GraphQLList', () => {
      builder.type('Group', {
        tags: { type: 'String', list: true },
      });
      builder.query('group', { type: 'Group', resolve: () => null });

      const schema = builder.build();
      const groupType = schema.getType('Group') as GraphQLObjectType;
      const tagsField = groupType.getFields().tags;

      expect(tagsField.type).toBeInstanceOf(GraphQLList);
    });

    it('should wrap required list fields in NonNull(List(...))', () => {
      builder.type('Collection', {
        items: { type: 'String', list: true, required: true },
      });
      builder.query('collection', { type: 'Collection', resolve: () => null });

      const schema = builder.build();
      const colType = schema.getType('Collection') as GraphQLObjectType;
      const itemsField = colType.getFields().items;

      expect(itemsField.type).toBeInstanceOf(GraphQLNonNull);
      const inner = (itemsField.type as GraphQLNonNull<any>).ofType;
      expect(inner).toBeInstanceOf(GraphQLList);
    });

    it('should support list modifier on query fields', () => {
      builder.type('User', { id: 'ID' });
      builder.query('users', {
        type: 'User',
        list: true,
        resolve: () => [],
      });

      const schema = builder.build();
      const field = schema.getQueryType()!.getFields().users;
      expect(field.type).toBeInstanceOf(GraphQLList);
    });

    it('should support required modifier on query return types', () => {
      builder.query('count', {
        type: 'Int',
        required: true,
        resolve: () => 42,
      });

      const schema = builder.build();
      const field = schema.getQueryType()!.getFields().count;
      expect(field.type).toBeInstanceOf(GraphQLNonNull);
    });
  });

  // --- Fluent API chaining ---

  describe('fluent API', () => {
    it('should return the builder instance from type()', () => {
      const result = builder.type('A', { x: 'String' });
      expect(result).toBe(builder);
    });

    it('should return the builder instance from input()', () => {
      const result = builder.input('B', { y: 'String' });
      expect(result).toBe(builder);
    });

    it('should return the builder instance from enum()', () => {
      const result = builder.enum('C', { X: undefined });
      expect(result).toBe(builder);
    });

    it('should return the builder instance from query()', () => {
      const result = builder.query('q', { type: 'String', resolve: () => '' });
      expect(result).toBe(builder);
    });

    it('should return the builder instance from mutation()', () => {
      const result = builder.mutation('m', { type: 'String', resolve: () => '' });
      expect(result).toBe(builder);
    });

    it('should allow chaining all methods together', () => {
      const schema = builder
        .enum('Status', { ON: undefined, OFF: undefined })
        .type('Device', { id: 'ID', status: { type: 'Status' } })
        .input('DeviceInput', { status: { type: 'Status' } })
        .query('device', { type: 'Device', resolve: () => null })
        .mutation('updateDevice', {
          type: 'Device',
          args: { input: { type: 'DeviceInput' } },
          resolve: () => null,
        })
        .build();

      expect(schema).toBeInstanceOf(GraphQLSchema);
    });
  });

  // --- createSchema factory ---

  describe('createSchema()', () => {
    it('should return a new SchemaBuilder instance', () => {
      const sb = createSchema();
      expect(sb).toBeInstanceOf(SchemaBuilder);
    });
  });
});
