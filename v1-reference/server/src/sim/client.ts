import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface SimOptions {
  /** e.g. http://localhost:8787 */
  baseUrl: string;
  /** The caller's number. Pass null to simulate a request with no caller header. */
  phone: string | null;
  secret?: string;
  direction?: string;
  agentNumber?: string;
}

export interface SimResult {
  isError: boolean;
  data: any;
}

/**
 * Plays the part of Dial: connects to our MCP endpoint with the same headers
 * Dial adds mid-call, so the backend can be built and tested without a phone.
 */
export async function openSimCall(opts: SimOptions) {
  const headers: Record<string, string> = {
    'x-dial-direction': opts.direction ?? 'inbound',
    'x-dial-agent-number': opts.agentNumber ?? '+15555550000',
  };
  if (opts.phone) headers['x-dial-user-number'] = opts.phone;
  if (opts.secret) headers['x-mcp-secret'] = opts.secret;

  const client = new Client({ name: 'dial-simulator', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${opts.baseUrl}/mcp`), {
    requestInit: { headers },
  });
  await client.connect(transport);

  return {
    async tools(): Promise<string[]> {
      return (await client.listTools()).tools.map((t) => t.name);
    },
    async call(name: string, args: Record<string, unknown> = {}): Promise<SimResult> {
      const res = await client.callTool({ name, arguments: args });
      const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
      const text = content.find((c) => c.type === 'text')?.text ?? '';
      let data: any = text;
      try {
        data = JSON.parse(text);
      } catch {
        /* leave as text */
      }
      return { isError: !!res.isError, data };
    },
    async close() {
      await client.close();
    },
  };
}
