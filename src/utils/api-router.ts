import { Router, RequestHandler } from "express";

export interface QueryParam {
  name: string;
  type: "string" | "integer" | "boolean";
  required?: boolean;
  description?: string;
  enum?: string[];
  default?: any;
}

export interface PathParam {
  name: string;
  type: "string" | "integer";
  required?: boolean;
  description?: string;
}

export interface RouteConfig {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  handler: RequestHandler;
  summary: string;
  description?: string;
  tags?: string[];
  queryParams?: QueryParam[];
  pathParams?: PathParam[];
  requestBody?: {
    required?: boolean;
    schema: string; // Reference to schema name
    example?: any;
  };
  responses?: {
    [statusCode: number]: {
      description: string;
      schema?: string;
    };
  };
}

export class ApiRouter {
  private router: Router;
  private routes: RouteConfig[] = [];

  constructor() {
    this.router = Router();
  }

  // Add route with configuration
  addRoute(config: RouteConfig): void {
    this.routes.push(config);

    // Register route with Express
    switch (config.method) {
      case "get":
        this.router.get(config.path, config.handler);
        break;
      case "post":
        this.router.post(config.path, config.handler);
        break;
      case "put":
        this.router.put(config.path, config.handler);
        break;
      case "delete":
        this.router.delete(config.path, config.handler);
        break;
      case "patch":
        this.router.patch(config.path, config.handler);
        break;
    }
  }

  // Generate Swagger documentation
  getSwaggerPaths(): any {
    const paths: any = {};

    this.routes.forEach((route) => {
      const swaggerPath = route.path.replace(/:(\w+)/g, "{$1}");

      if (!paths[swaggerPath]) {
        paths[swaggerPath] = {};
      }

      const operation: any = {
        summary: route.summary,
        tags: route.tags || ["API"],
        parameters: [],
      };

      if (route.description) {
        operation.description = route.description;
      }

      // Add path parameters
      if (route.pathParams) {
        route.pathParams.forEach((param) => {
          operation.parameters.push({
            in: "path",
            name: param.name,
            required: param.required !== false,
            schema: { type: param.type },
            description: param.description,
          });
        });
      }

      // Add query parameters
      if (route.queryParams) {
        route.queryParams.forEach((param) => {
          const paramDef: any = {
            in: "query",
            name: param.name,
            required: param.required || false,
            schema: { type: param.type },
            description: param.description,
          };

          if (param.enum) {
            paramDef.schema.enum = param.enum;
          }

          if (param.default !== undefined) {
            paramDef.schema.default = param.default;
          }

          operation.parameters.push(paramDef);
        });
      }

      // Add request body
      if (route.requestBody) {
        operation.requestBody = {
          required: route.requestBody.required !== false,
          content: {
            "application/json": {
              schema: {
                $ref: `#/components/schemas/${route.requestBody.schema}`,
              },
            },
          },
        };

        if (route.requestBody.example) {
          operation.requestBody.content["application/json"].example =
            route.requestBody.example;
        }
      }

      // Add responses
      operation.responses = {};
      if (route.responses) {
        Object.keys(route.responses).forEach((statusCode) => {
          const response = route.responses![Number(statusCode)];
          operation.responses[statusCode] = {
            description: response.description,
            content: response.schema
              ? {
                  "application/json": {
                    schema: { $ref: `#/components/schemas/${response.schema}` },
                  },
                }
              : undefined,
          };
        });
      } else {
        // Default responses
        operation.responses["200"] = {
          description: "Successful operation",
        };
        operation.responses["500"] = {
          description: "Server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        };
      }

      paths[swaggerPath][route.method] = operation;
    });

    return paths;
  }

  getRouter(): Router {
    return this.router;
  }

  getRoutes(): RouteConfig[] {
    return this.routes;
  }
}

export default ApiRouter;
