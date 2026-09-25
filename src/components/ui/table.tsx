"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Contexto interno: permite que <Table compact> achique fuente/padding de
// TableHead y TableCell sin tener que pasarles la prop a cada celda. Por
// default (sin `compact`) el tamaño es idéntico al de siempre — así todas
// las tablas existentes (Clientes, Proveedores, Sueldos, Cheques, Reportes,
// Vault) quedan sin cambios; solo Ventas y Compras activan el modo
// compacto, que son las que tienen más columnas y sufrían scroll horizontal.
const TableDensityContext = React.createContext(false);

const Table = ({
  className,
  compact = false,
  ...props
}: React.HTMLAttributes<HTMLTableElement> & { compact?: boolean }) => (
  <TableDensityContext.Provider value={compact}>
    <div className="w-full overflow-auto rounded-lg border border-border">
      <table className={cn("w-full", compact ? "text-xs" : "text-sm", className)} {...props} />
    </div>
  </TableDensityContext.Provider>
);

const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("bg-muted text-muted-foreground", className)} {...props} />
);

const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("divide-y divide-border", className)} {...props} />
);

const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("hover:bg-muted/50 transition-colors", className)} {...props} />
);

const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => {
  const compact = React.useContext(TableDensityContext);
  return (
    <th
      className={cn(
        "text-left align-middle font-medium",
        compact ? "h-8 px-2" : "h-10 px-4",
        className
      )}
      {...props}
    />
  );
};

const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
  const compact = React.useContext(TableDensityContext);
  return <td className={cn(compact ? "p-2" : "p-4", "align-middle", className)} {...props} />;
};

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };