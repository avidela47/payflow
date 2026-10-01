"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PayrollPeriodFilter({ selectedPeriod }: { selectedPeriod: string | null }) {
  const router = useRouter();

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="periodFilter">Mostrando</Label>
        <Input
          id="periodFilter"
          type="month"
          value={selectedPeriod ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              router.push(`/sueldos?period=${e.target.value}`);
            }
          }}
          className="w-auto"
        />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => router.push("/sueldos?period=all")}>
        Ver todos
      </Button>
    </div>
  );
}