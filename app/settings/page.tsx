"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Bot,
  Check,
  GraduationCap,
  Palette,
  Save,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { readApiResponse } from "@/lib/api-client";

type SettingsData = {
  displayName: string;
  bio: string;
  educationLevel: string;
  primaryGoal: string;
  weeklyStudyGoalMinutes: number;
  theme: string;
  reviewNotifications: boolean;
  weeklySummary: boolean;
  processingNotifications: boolean;
  alwaysShowSources: boolean;
  adaptToEducationLevel: boolean;
};
const defaults: SettingsData = {
  displayName: "",
  bio: "",
  educationLevel: "UNDERGRADUATE",
  primaryGoal: "",
  weeklyStudyGoalMinutes: 480,
  theme: "LIGHT",
  reviewNotifications: true,
  weeklySummary: true,
  processingNotifications: true,
  alwaysShowSources: true,
  adaptToEducationLevel: true,
};

export default function SettingsPage() {
  const [data, setData] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => readApiResponse<SettingsData>(response))
      .then((result) => {
        if (result.data) setData(result.data);
      })
      .catch((error) =>
        toast.error("Falha ao carregar configurações", {
          description:
            error instanceof Error ? error.message : "Tente novamente.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);
  function update<K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K],
  ): void {
    setData((current) => ({ ...current, [key]: value }));
  }
  async function save(): Promise<void> {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...data,
          bio: data.bio || null,
          primaryGoal: data.primaryGoal || null,
        }),
      });
      await readApiResponse<SettingsData>(response);
      toast.success("Configurações salvas", {
        description: "Suas preferências foram atualizadas.",
      });
    } catch (error) {
      toast.error("Falha ao salvar", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <PageHeader
        eyebrow="Preferências"
        title="Configurações"
        description="Seus dados e preferências são persistidos no perfil."
        icon={Settings}
      />
      {loading ? (
        <div className="surface grid min-h-80 place-items-center text-sm text-slate-500">
          Carregando configurações...
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="surface h-fit p-2">
            <Nav icon={<GraduationCap />} label="Perfil" active />
            <Nav icon={<Palette />} label="Aparência" />
            <Nav icon={<Bell />} label="Notificações" />
            <Nav icon={<Bot />} label="Tutora IA" />
            <Nav icon={<ShieldCheck />} label="Privacidade" />
          </aside>
          <div className="space-y-5">
            <section className="surface p-5 sm:p-6">
              <h2 className="section-title">Perfil acadêmico</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <input
                    value={data.displayName}
                    onChange={(event) =>
                      update("displayName", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </Field>
                <Field label="Escolaridade">
                  <select
                    value={data.educationLevel}
                    onChange={(event) =>
                      update("educationLevel", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  >
                    <option value="ELEMENTARY">Ensino fundamental</option>
                    <option value="HIGH_SCHOOL">Ensino médio</option>
                    <option value="UNDERGRADUATE">Ensino superior</option>
                    <option value="GRADUATE">Pós-graduação</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </Field>
                <Field label="Objetivo principal">
                  <input
                    value={data.primaryGoal}
                    onChange={(event) =>
                      update("primaryGoal", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </Field>
                <Field label="Meta semanal (minutos)">
                  <input
                    type="number"
                    value={data.weeklyStudyGoalMinutes}
                    onChange={(event) =>
                      update(
                        "weeklyStudyGoalMinutes",
                        Number(event.target.value),
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </Field>
              </div>
              <Field label="Biografia" className="mt-4">
                <textarea
                  value={data.bio}
                  onChange={(event) => update("bio", event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                />
              </Field>
            </section>
            <section className="surface p-5 sm:p-6">
              <h2 className="section-title">Aparência</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["LIGHT", "Claro"],
                  ["DARK", "Escuro"],
                  ["SYSTEM", "Sistema"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => update("theme", value)}
                    className={`relative min-h-16 rounded-xl border text-sm font-semibold ${data.theme === value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}
                  >
                    {label}
                    {data.theme === value && (
                      <Check className="absolute right-2 top-2 size-3" />
                    )}
                  </button>
                ))}
              </div>
            </section>
            <section className="surface p-5 sm:p-6">
              <h2 className="section-title">Notificações e IA</h2>
              <div className="mt-4 divide-y divide-slate-100">
                <Toggle
                  title="Lembretes de revisão"
                  value={data.reviewNotifications}
                  onChange={(value) => update("reviewNotifications", value)}
                />
                <Toggle
                  title="Resumo semanal"
                  value={data.weeklySummary}
                  onChange={(value) => update("weeklySummary", value)}
                />
                <Toggle
                  title="Avisar quando material estiver pronto"
                  value={data.processingNotifications}
                  onChange={(value) => update("processingNotifications", value)}
                />
                <Toggle
                  title="Sempre mostrar fontes"
                  value={data.alwaysShowSources}
                  onChange={(value) => update("alwaysShowSources", value)}
                />
                <Toggle
                  title="Adaptar explicações à escolaridade"
                  value={data.adaptToEducationLevel}
                  onChange={(value) => update("adaptToEducationLevel", value)}
                />
              </div>
            </section>
            <div className="flex justify-end">
              <button
                disabled={saving}
                onClick={() => void save()}
                className="primary-button"
              >
                <Save className="size-4" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Nav({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold [&>svg]:size-4 ${active ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}
    >
      {icon}
      {label}
    </div>
  );
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-bold text-navy">{label}</span>
      {children}
    </label>
  );
}
function Toggle({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <strong className="flex-1 text-sm text-navy">{title}</strong>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 rounded-full ${value ? "bg-blue-600" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${value ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}
