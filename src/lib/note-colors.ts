// Constantes de color para Notas, separadas de src/models/Note.ts a propósito:
// ese archivo importa mongoose, y si un componente cliente importa algo de
// ahí (aunque sea solo este array), Next mete TODO mongoose en el bundle del
// browser. Este archivo no importa nada del servidor, así que es seguro
// usarlo tanto desde el modelo como desde componentes "use client".
export const NOTE_COLORS = ["yellow", "pink", "blue", "green", "purple", "orange"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];