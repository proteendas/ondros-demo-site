import { Zap, Shield, Globe, Layers, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  shield: Shield,
  globe: Globe,
  layers: Layers,
  sparkles: Sparkles,
};

export function FeatureIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} />;
}
