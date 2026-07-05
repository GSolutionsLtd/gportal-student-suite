import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, CheckCircle2, LucideIcon } from "lucide-react";
import { trackCta } from "@/lib/trackCta";

interface Props {
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  ctaSource: string;
}

export function NewFeaturePage({ icon: Icon, title, tagline, description, highlights, ctaSource }: Props) {
  const navigate = useNavigate();

  const contact = () => {
    trackCta(ctaSource);
    navigate(`/contact?source=${encodeURIComponent(ctaSource)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="default" className="gap-1">
          <Sparkles className="h-3 w-3" /> New Feature
        </Badge>
        <Badge variant="outline">Early Access</Badge>
      </div>

      <Card className="p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-start gap-5 flex-wrap">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-md shrink-0">
            <Icon className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>
            <p className="text-primary font-medium mb-3">{tagline}</p>
            <p className="text-muted-foreground max-w-2xl">{description}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">What's included</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {highlights.map((h) => (
            <li key={h} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6 md:p-8 gradient-primary text-primary-foreground">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold mb-1">Want to enable {title} for your school?</h3>
            <p className="text-primary-foreground/80 text-sm">Join the early access programme — our team will onboard your school.</p>
          </div>
          <Button size="lg" variant="secondary" onClick={contact} className="gap-2">
            Request Early Access <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
