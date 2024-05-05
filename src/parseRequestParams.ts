export interface Params {
  query: string;
  variables?: Record<string, any>;
}

export const parseRequestParams = async (request: Request): Promise<Params> => {
  const method = request.method;
  if (method !== "GET" && method !== "POST") {
    throw new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
      headers: {
        allow: "GET, POST",
      },
    });
  }

  const [mediaType, charset = "charset=utf-8"] = (request.headers.get("content-type") || "")
    .replace(/\s/g, "")
    .toLowerCase()
    .split(";");

  let query: string | undefined | null;
  let variables: string | number | boolean | Record<string, any> | any[] | undefined | null;

  if (method === "GET") {
    const [, search] = request.url.split("?");
    const searchParams = new URLSearchParams(search);
    query = searchParams.get("query");
    const _variables = searchParams.get("variables");
    if (_variables) {
      try {
        variables = JSON.parse(_variables);
      } catch {
        throw new Response(null, { status: 400, statusText: "Bad Request" });
      }
    }
  } else if (method === "POST" && mediaType === "application/json" && charset === "charset=utf-8") {
    if (!request.body) {
      throw new Response(null, { status: 400, statusText: "Bad Request" });
    }
    let data: any;
    try {
      const body = await request.text();
      data = JSON.parse(body);
    } catch {
      throw new Response(null, { status: 400, statusText: "Bad Request" });
    }
    if (data === null || typeof data !== "object") {
      throw new Response(null, { status: 400, statusText: "Bad Request" });
    }
    query = data.query;
    variables = data.variables;
  } else {
    throw new Response(null, {
      status: 415,
      statusText: "Unsupported Media Type",
    });
  }

  if (typeof query !== "string") {
    throw new Response(null, { status: 400, statusText: "Bad Request" });
  }

  if (!variables) {
    return { query };
  }

  if (typeof variables !== "object" || Array.isArray(variables)) {
    throw new Response(null, { status: 400, statusText: "Bad Request" });
  }

  return { query, variables };
};
