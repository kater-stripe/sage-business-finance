'use client';

import { type ReactNode } from 'react';
import { ToolsPanelProvider } from '@demoeng/tools-panel';

export const ToolsPanelWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <ToolsPanelProvider
      config={{
        apiActivity: {
          enabled: true,
        },
        // Ignore `demoConfig` here and do not make modifications here because it's disabled.
        demoConfig: {
          enabled: false,
          tabs: {
            apiKeysAndEnvironment: {
              items: []
            },
            checkout: {
              items: []
            },
            connect: {
              items: []
            },
            integrationAndLocalization: {
              items: []
            },
            seedingAndTestHelpers: {
              items: []
            },
            terminalAndPos: {
              items: []
            }
          },
          onReset: () => {},
        },
      }}
    >
      {children}
    </ToolsPanelProvider>
  );
};
