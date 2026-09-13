import type { SlideData, ThemeSettings } from "../lib/types";
import NumberStylePicker from "./NumberStylePicker";
import { ColorInput, Field, Slider, TextInput, Toggle } from "./ui";

interface Props {
  theme: ThemeSettings;
  slide?: SlideData;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  updateSlide: (id: string, patch: Partial<SlideData>) => void;
  onSelectBullet: () => void;
}

export default function QuestionBulletPanel({ theme: T, slide, setTheme, updateSlide, onSelectBullet }: Props) {
  return (
    <div className="space-y-4">
      <PanelTitle title="Question bullet" subtitle="Design and position the question number marker." />
      <Toggle label="Show question bullet" checked={T.showBullet} onChange={(v) => setTheme({ showBullet: v })} />
      <Toggle label="Show number inside bullet" checked={T.showNumber} onChange={(v) => setTheme({ showNumber: v })} />
      {slide && (
        <Field label="Question number">
          <TextInput value={slide.number} onChange={(e) => updateSlide(slide.id, { number: e.target.value })} />
        </Field>
      )}
      <Field label="Numbering style"><NumberStylePicker theme={T} setTheme={setTheme} /></Field>
      <Field label="Bullet size" hint={`${T.bulletSize}px`}>
        <Slider min={28} max={96} value={T.bulletSize} onChange={(v) => setTheme({ bulletSize: v })} />
      </Field>
      <ColorInput label="Bullet / numbering colour" value={T.accent} onChange={(v) => setTheme({ accent: v })} />
      <Toggle
        label="Bullet is a separate movable element"
        checked={T.bulletSeparate}
        onChange={(v) => {
          setTheme({ bulletSeparate: v });
          if (v) onSelectBullet();
        }}
      />
      {T.bulletSeparate && (
        <button onClick={onSelectBullet} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:border-amber-400/60">
          Select bullet on canvas for free alignment and layers
        </button>
      )}
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="border-b border-white/10 pb-3"><h2 className="text-base font-semibold text-slate-100">{title}</h2><p className="text-[11px] text-slate-500">{subtitle}</p></div>;
}