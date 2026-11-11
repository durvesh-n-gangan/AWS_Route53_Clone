"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Modal from "@cloudscape-design/components/modal";

export const SHORTCUTS = [
  { key: "/", description: "Focus the search or filter box on the page" },
  { key: "c", description: "Create: a hosted zone on the list, a record inside a zone" },
  { key: "r", description: "Refresh the data on the page" },
  { key: "?", description: "Show this list of keyboard shortcuts" },
];

export function ShortcutsModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  // Not mounted while closed, so it never sits in the DOM next to other dialogs.
  if (!visible) return null;
  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header="Keyboard shortcuts"
      closeAriaLabel="Close dialog"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            Close
          </Button>
        </Box>
      }
    >
      <KeyValuePairs
        columns={1}
        items={SHORTCUTS.map((shortcut) => ({
          label: <kbd>{shortcut.key}</kbd>,
          value: shortcut.description,
        }))}
      />
      <Box variant="small" color="text-body-secondary" margin={{ top: "m" }}>
        Shortcuts are paused while you type in a field or a dialog is open.
      </Box>
    </Modal>
  );
}
