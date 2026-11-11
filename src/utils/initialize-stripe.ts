import Stripe from "stripe";
import * as net from "net";
import * as tls from "tls";
import * as https from "https";
import { cookies } from "next/headers";
import { createInitializeStripe } from "@demoeng/tools-panel";

const createProxyAgent = () => {
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? "";
  const m = proxyUrl.match(/https?:\/\/([^:]+):(\d+)/);
  if (!m) return undefined;

  const [, proxyHost, proxyPortStr] = m;
  const proxyPort = parseInt(proxyPortStr);

  class ProxyAgent extends https.Agent {
    createConnection(
      options: https.RequestOptions,
      callback: (err: Error | null, stream: import("stream").Duplex) => void,
    ): import("stream").Duplex | null | undefined {
      const targetHost =
        (options as { hostname?: string; host?: string }).hostname ??
        (options as { hostname?: string; host?: string }).host ??
        "";
      const targetPort = (options as { port?: number }).port ?? 443;
      const sock = net.createConnection(proxyPort, proxyHost, () => {
        sock.write(
          `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`,
        );
        sock.once("data", (chunk) => {
          if (!chunk.toString().includes(" 200 ")) {
            callback(
              new Error(`CONNECT failed: ${chunk.toString().slice(0, 80)}`),
              null as unknown as import("stream").Duplex,
            );
            sock.destroy();
            return;
          }
          const tlsSock = tls.connect({ socket: sock, servername: targetHost });
          callback(null as unknown as Error, tlsSock);
        });
      });
      sock.on("error", (err) =>
        callback(err, null as unknown as import("stream").Duplex),
      );
      return undefined;
    }
  }

  return new ProxyAgent();
};

type InitializeStripeParams = Parameters<
  ReturnType<typeof createInitializeStripe>
>;

export const initializeStripe = (
  apiKey: InitializeStripeParams[0],
  options?: InitializeStripeParams[1],
) => {
  const initializeStripe = createInitializeStripe({
    Stripe,
    cookies,
  });

  const proxyAgent = createProxyAgent();

  return initializeStripe(apiKey, {
    ...options,
    ...(process.env.NODE_ENV === "development"
      ? {
          proxyAgent,
        }
      : {}),
  });
};
