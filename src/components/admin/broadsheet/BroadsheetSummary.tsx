import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Award, TrendingUp, TrendingDown } from "lucide-react";
import type { BroadsheetRow } from "./BroadsheetTable";

interface BroadsheetSummaryProps {
  rows: BroadsheetRow[];
  selectedSubject: string;
}

export function BroadsheetSummary({ rows, selectedSubject }: BroadsheetSummaryProps) {
  const stats = useMemo(() => {
    const scores = rows
      .map(r => selectedSubject === "all" ? r.average_score : r.subject_score)
      .filter((s): s is number => s !== null && s !== undefined);

    const total = scores.length;
    const avg = total ? scores.reduce((a, b) => a + b, 0) / total : 0;
    const highest = total ? Math.max(...scores) : 0;
    const lowest = total ? Math.min(...scores) : 0;
    const passCount = scores.filter(s => s >= 50).length;
    const passRate = total ? (passCount / total) * 100 : 0;

    return {
      totalStudents: total,
      classAverage: Number(avg.toFixed(1)),
      highest: Number(highest.toFixed(1)),
      lowest: Number(lowest.toFixed(1)),
      passRate: Number(passRate.toFixed(1)),
    };
  }, [rows, selectedSubject]);

  const cards = [
    { label: "Total Students", value: stats.totalStudents, icon: Users, color: "text-primary" },
    { label: "Class Average", value: stats.classAverage, icon: TrendingUp, color: "text-blue-500" },
    { label: "Highest Score", value: stats.highest, icon: Award, color: "text-emerald-500" },
    { label: "Lowest Score", value: stats.lowest, icon: TrendingDown, color: "text-red-500" },
    { label: "Pass Rate", value: `${stats.passRate}%`, icon: Award, color: "text-amber-500" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(card => (
        <Card key={card.label}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <card.icon className={`h-8 w-8 ${card.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xl font-bold">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
