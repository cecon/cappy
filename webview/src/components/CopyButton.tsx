import { ActionIcon, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";

interface CopyButtonProps {
  value: string;
  size?: number;
  className?: string | undefined;
}

export function CopyButton({ value, size = 13, className }: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip label={copied ? "Copiado!" : "Copiar"} withArrow position="top">
      <ActionIcon
        variant="subtle"
        color={copied ? "teal" : "gray"}
        size="sm"
        aria-label="Copiar"
        {...(className !== undefined ? { className } : {})}
        onClick={handleCopy}
      >
        {copied ? <IconCheck size={size} /> : <IconCopy size={size} />}
      </ActionIcon>
    </Tooltip>
  );
}
