import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Download, Copy, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Term {
  id: string;
  name: string;
  is_current: boolean;
}

interface GeneratedPin {
  serial_number: string;
  pin_code: string;
}

export const GeneratePinsTab = () => {
  const { user } = useAuth();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    term_id: "",
    quantity: 10,
    max_usage: 5,
    expires_days: 90,
    prefix: "PIN",
  });
  const [generatedPins, setGeneratedPins] = useState<GeneratedPin[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    const { data } = await supabase
      .from("terms")
      .select("id, name, is_current")
      .order("start_date", { ascending: false });
    setTerms(data || []);

    const currentTerm = data?.find((t) => t.is_current);
    if (currentTerm) {
      setFormData((prev) => ({ ...prev, term_id: currentTerm.id }));
    }
  };

  const generateRandomString = (length: number, chars: string) => {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateSerialNumber = (prefix: string, index: number) => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = generateRandomString(4, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    return `${prefix}-${timestamp}-${random}-${String(index).padStart(4, "0")}`;
  };

  const generatePinCode = () => {
    return generateRandomString(12, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.term_id) {
      toast.error("Please select a term");
      return;
    }

    if (formData.quantity < 1 || formData.quantity > 100) {
      toast.error("Quantity must be between 1 and 100");
      return;
    }

    setLoading(true);
    setGeneratedPins([]);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + formData.expires_days);

      const pinsToInsert = [];
      const newPins: GeneratedPin[] = [];

      for (let i = 1; i <= formData.quantity; i++) {
        const serial_number = generateSerialNumber(formData.prefix, i);
        const pin_code = generatePinCode();

        pinsToInsert.push({
          serial_number,
          pin_code,
          term_id: formData.term_id,
          max_usage: formData.max_usage,
          expires_at: expiresAt.toISOString(),
          generated_by: user?.id,
          status: "active" as const,
        });

        newPins.push({ serial_number, pin_code });
      }

      const { error } = await supabase.from("pins").insert(pinsToInsert);

      if (error) {
        toast.error("Failed to generate PINs: " + error.message);
      } else {
        toast.success(`Successfully generated ${formData.quantity} PINs`);
        setGeneratedPins(newPins);
      }
    } catch (error) {
      toast.error("An error occurred while generating PINs");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPin = async (pin: GeneratedPin, index: number) => {
    await navigator.clipboard.writeText(`Serial: ${pin.serial_number}\nPIN: ${pin.pin_code}`);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success("PIN copied to clipboard");
  };

  const handleCopyAll = async () => {
    const text = generatedPins
      .map((pin) => `${pin.serial_number}\t${pin.pin_code}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("All PINs copied to clipboard");
  };

  const handleDownloadCSV = () => {
    const headers = "Serial Number,PIN Code\n";
    const rows = generatedPins
      .map((pin) => `${pin.serial_number},${pin.pin_code}`)
      .join("\n");
    const csv = headers + rows;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pins-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Generate New PINs</CardTitle>
          <CardDescription>
            Create new result access PINs for students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label>Term</Label>
              <Select
                value={formData.term_id}
                onValueChange={(value) => setFormData({ ...formData, term_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term..." />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name} {term.is_current && "(Current)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (1-100)</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_usage">Max Usage</Label>
                <Input
                  id="max_usage"
                  type="number"
                  min={1}
                  max={10}
                  value={formData.max_usage}
                  onChange={(e) =>
                    setFormData({ ...formData, max_usage: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expires_days">Expires In (Days)</Label>
                <Input
                  id="expires_days"
                  type="number"
                  min={1}
                  max={365}
                  value={formData.expires_days}
                  onChange={(e) =>
                    setFormData({ ...formData, expires_days: parseInt(e.target.value) || 90 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefix">Serial Prefix</Label>
                <Input
                  id="prefix"
                  value={formData.prefix}
                  onChange={(e) =>
                    setFormData({ ...formData, prefix: e.target.value.toUpperCase().slice(0, 5) })
                  }
                  maxLength={5}
                  placeholder="PIN"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate {formData.quantity} PINs
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Generated PINs</CardTitle>
            <CardDescription>
              {generatedPins.length > 0
                ? `${generatedPins.length} PINs generated`
                : "Generate PINs to see them here"}
            </CardDescription>
          </div>
          {generatedPins.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                <Copy className="h-4 w-4 mr-1" />
                Copy All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {generatedPins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No PINs generated yet. Use the form to generate new PINs.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>PIN Code</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedPins.map((pin, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">
                        {pin.serial_number}
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {pin.pin_code}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyPin(pin, index)}
                        >
                          {copiedIndex === index ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
