import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
} from 'graphql';

// === Types ===

type ScalarName = 'String' | 'Int' | 'Float' | 'Boolean' | 'ID';

interface FieldDefinition {
  type: ScalarName | string;
  list?: boolean;
  required?: boolean;
  description?: string;
  resolve?: (...args: any[]) => any;
  args?: Record<string, ArgDefinition>;
}

interface ArgDefinition {
  type: ScalarName | string;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
}

interface TypeDefinition {
  name: string;
  description?: string;
  fields: Record<string, FieldDefinition | ScalarName>;
}

interface EnumDefinition {
  name: string;
  description?: string;
  values: Record<string, { value?: unknown; description?: string } | undefined>;
}

// === Schema Builder ===

export class SchemaBuilder {
  private types: Map<string, TypeDefinition> = new Map();
  private inputTypes: Map<string, TypeDefinition> = new Map();
  private enums: Map<string, EnumDefinition> = new Map();
  private queries: Record<string, FieldDefinition> = {};
  private mutations: Record<string, FieldDefinition> = {};
  private builtTypes: Map<string, GraphQLObjectType> = new Map();
  private builtInputTypes: Map<string, GraphQLInputObjectType> = new Map();
  private builtEnums: Map<string, GraphQLEnumType> = new Map();

  type(name: string, fields: Record<string, FieldDefinition | ScalarName>, description?: string): this {
    this.types.set(name, { name, description, fields });
    return this;
  }

  input(name: string, fields: Record<string, FieldDefinition | ScalarName>, description?: string): this {
    this.inputTypes.set(name, { name, description, fields });
    return this;
  }

  enum(name: string, values: Record<string, { value?: unknown; description?: string } | undefined>, description?: string): this {
    this.enums.set(name, { name, description, values });
    return this;
  }

  query(name: string, field: FieldDefinition): this {
    this.queries[name] = field;
    return this;
  }

  mutation(name: string, field: FieldDefinition): this {
    this.mutations[name] = field;
    return this;
  }

  build(): GraphQLSchema {
    // Build enums first
    for (const [name, def] of this.enums) {
      const values: Record<string, { value?: unknown; description?: string }> = {};
      for (const [key, config] of Object.entries(def.values)) {
        values[key] = config ?? {};
      }
      this.builtEnums.set(name, new GraphQLEnumType({
        name,
        description: def.description,
        values,
      }));
    }

    const schemaConfig: { query?: GraphQLObjectType; mutation?: GraphQLObjectType } = {};

    if (Object.keys(this.queries).length > 0) {
      schemaConfig.query = new GraphQLObjectType({
        name: 'Query',
        fields: () => this.buildFieldMap(this.queries),
      });
    }

    if (Object.keys(this.mutations).length > 0) {
      schemaConfig.mutation = new GraphQLObjectType({
        name: 'Mutation',
        fields: () => this.buildFieldMap(this.mutations),
      });
    }

    return new GraphQLSchema(schemaConfig);
  }

  private buildFieldMap(fields: Record<string, FieldDefinition>): GraphQLFieldConfigMap<any, any> {
    const result: GraphQLFieldConfigMap<any, any> = {};

    for (const [name, def] of Object.entries(fields)) {
      const fieldConfig: GraphQLFieldConfig<any, any> = {
        type: this.resolveOutputType(def) as GraphQLOutputType,
        description: def.description,
        resolve: def.resolve,
      };

      if (def.args) {
        fieldConfig.args = {};
        for (const [argName, argDef] of Object.entries(def.args)) {
          fieldConfig.args[argName] = {
            type: this.resolveInputType(argDef) as GraphQLInputType,
            defaultValue: argDef.defaultValue,
            description: argDef.description,
          };
        }
      }

      result[name] = fieldConfig;
    }

    return result;
  }

  private resolveOutputType(def: FieldDefinition | ArgDefinition): GraphQLOutputType {
    let baseType = this.getOutputType(def.type);
    if ('list' in def && def.list) {
      baseType = new GraphQLList(baseType);
    }
    if (def.required) {
      return new GraphQLNonNull(baseType);
    }
    return baseType;
  }

  private resolveInputType(def: ArgDefinition): GraphQLInputType {
    let baseType = this.getInputType(def.type);
    if (def.required) {
      return new GraphQLNonNull(baseType);
    }
    return baseType;
  }

  private getOutputType(typeName: string): GraphQLOutputType {
    const scalar = this.getScalar(typeName);
    if (scalar) return scalar;

    if (this.builtEnums.has(typeName)) {
      return this.builtEnums.get(typeName)!;
    }

    if (this.builtTypes.has(typeName)) {
      return this.builtTypes.get(typeName)!;
    }

    const typeDef = this.types.get(typeName);
    if (!typeDef) {
      throw new Error(`Unknown type: ${typeName}`);
    }

    const objType = new GraphQLObjectType({
      name: typeName,
      description: typeDef.description,
      fields: () => {
        const fields: GraphQLFieldConfigMap<any, any> = {};
        for (const [fieldName, fieldDef] of Object.entries(typeDef.fields)) {
          const normalized = typeof fieldDef === 'string'
            ? { type: fieldDef }
            : fieldDef;
          fields[fieldName] = {
            type: this.resolveOutputType(normalized) as GraphQLOutputType,
            description: normalized.description,
            resolve: normalized.resolve,
          };
        }
        return fields;
      },
    });

    this.builtTypes.set(typeName, objType);
    return objType;
  }

  private getInputType(typeName: string): GraphQLInputType {
    const scalar = this.getScalar(typeName);
    if (scalar) return scalar;

    if (this.builtEnums.has(typeName)) {
      return this.builtEnums.get(typeName)!;
    }

    if (this.builtInputTypes.has(typeName)) {
      return this.builtInputTypes.get(typeName)!;
    }

    const typeDef = this.inputTypes.get(typeName);
    if (!typeDef) {
      throw new Error(`Unknown input type: ${typeName}`);
    }

    const inputType = new GraphQLInputObjectType({
      name: typeName,
      description: typeDef.description,
      fields: () => {
        const fields: GraphQLInputFieldConfigMap = {};
        for (const [fieldName, fieldDef] of Object.entries(typeDef.fields)) {
          const normalized = typeof fieldDef === 'string'
            ? { type: fieldDef }
            : fieldDef;
          fields[fieldName] = {
            type: this.resolveInputType(normalized) as GraphQLInputType,
            description: normalized.description,
          };
        }
        return fields;
      },
    });

    this.builtInputTypes.set(typeName, inputType);
    return inputType;
  }

  private getScalar(name: string): GraphQLOutputType | null {
    const scalars: Record<string, GraphQLOutputType> = {
      String: GraphQLString,
      Int: GraphQLInt,
      Float: GraphQLFloat,
      Boolean: GraphQLBoolean,
      ID: GraphQLID,
    };
    return scalars[name] ?? null;
  }
}

export function createSchema(): SchemaBuilder {
  return new SchemaBuilder();
}

/** Check if a type name is a built-in GraphQL scalar */
export function isScalarType(name: string): name is ScalarName {
  return ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(name);
}

export default SchemaBuilder;
