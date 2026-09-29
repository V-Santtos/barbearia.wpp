import React from "react";
import { VISUAL_MOCK_ENABLED } from "../api";
import { useFillAdvance } from "../hooks/useFillAdvance";

interface Props {
  name: string;
  setName: (v: string) => void;
  back: () => void;
  next: () => void;
}

export default function StepName({ name, setName, back, next }: Props) {
  const normalized = name.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ").filter(Boolean);

  const connectors = new Set(["de", "da", "do", "das", "dos", "e"]);
  const realWords = parts.filter((p) => !connectors.has(p.toLowerCase()));

  const hasTwoRealWords = realWords.length >= 2;
  const allRealWordsOk = realWords.every((w) => w.length >= 2);
  const hasMinLength = normalized.length >= 8;

  const isValid = VISUAL_MOCK_ENABLED
    ? normalized.length > 0
    : hasTwoRealWords && allRealWordsOk && hasMinLength;

  const fill = useFillAdvance();

  return (
    <section id="step-name" className="step">
      {/* ===== LABEL + INPUT ===== */}
      <label
        htmlFor="name"
        className="label step-name-title animate-fade-in-down animation-delay-200"
      >
        Digite seu nome completo
      </label>

      <div className="field step-name-field" style={{ position: "relative" }}>
        {/* input fantasma */}
        <input
          type="text"
          autoComplete="off"
          tabIndex={-1}
          style={{
            position: "absolute",
            opacity: 0,
            height: 0,
            width: 0,
            pointerEvents: "none",
          }}
        />

        <input
          id="name"
          type="text"
          name="user-fullname"
          autoComplete="off"
          placeholder="Ex: João da Silva"
          className="step-name-input animate-fade-in-up animation-delay-400"
          value={name}
          onChange={(e) => {
            let raw = e.target.value;

            // 1) remove tudo que não for letra, acento ou espaço
            raw = raw.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, "");

            // 2) impede múltiplos espaços seguidos
            raw = raw.replace(/\s{2,}/g, " ");

            // 3) impede espaço no começo
            raw = raw.replace(/^\s+/g, "");

            // 4) limite de caracteres seguro (50)
            raw = raw.slice(0, 50);

            setName(raw);
          }}
        />

        <div className="step-name-actions animate-fade-in-up animation-delay-600">
          <button className="liquid-btn step-name-back" onClick={back}>
            Voltar
          </button>
          <button
            id="go-name"
            className={`liquid-btn step-name-next ${isValid ? "enabled fill-btn" : ""} ${fill.filling ? "is-filling" : ""}`}
            disabled={!isValid}
            onClick={() => {
              if (isValid) fill.run(next);
            }}
          >
            Prosseguir
          </button>
        </div>
      </div>
    </section>
  );
}
