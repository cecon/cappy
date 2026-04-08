import { FormEvent, useState } from "react";
import styles from "./InputBar.module.css";

interface InputBarProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
}

/**
 * Input and submit controls for chat.
 */
export function InputBar({ onSend, isStreaming }: InputBarProps): JSX.Element {
  const [value, setValue] = useState("");

  /**
   * Handles submit from input form.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = value.trim();
    if (!text) {
      return;
    }
    onSend(text);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Digite uma mensagem..."
        className={styles.input}
        disabled={isStreaming}
      />
      <button type="submit" disabled={isStreaming} className={styles.button}>
        Enviar
      </button>
    </form>
  );
}
