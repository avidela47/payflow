// Equipo de la pestaña "Proyectos" (ex proyectos-itelsa), portado tal cual del
// index.html original — lista fija de 7 personas, NO viene de ninguna colección
// de usuarios ni de PayFlow. Se preserva así a propósito (ver conversación: "que
// se maneje como ya lo hace la app sola", mismo criterio aplicado acá): es la
// identidad que usa el equipo hoy para asignar tareas y mandar notificaciones,
// independiente de quién esté logueado en PayFlow.
export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  cls: string; // clase de color de avatar (av1..av7), ver proyectos.css
};

export const TEAM: TeamMember[] = [
  { id: "t1", name: "Sofia", initials: "SO", cls: "av1" },
  { id: "t2", name: "Meli", initials: "ME", cls: "av2" },
  { id: "t3", name: "Fabio", initials: "FA", cls: "av3" },
  { id: "t4", name: "Ruben", initials: "RU", cls: "av4" },
  { id: "t5", name: "Cande", initials: "CN", cls: "av5" },
  { id: "t6", name: "Francisco", initials: "FR", cls: "av6" },
  { id: "t7", name: "Flor", initials: "FL", cls: "av7" },
];

export const TEAM_EMAILS: Record<string, string> = {
  t1: "sofiagcastex@gmail.com",
  t2: "arquitectura@itelsasas.com",
  t3: "Fabiopalencia9@hotmail.com",
  t4: "rpozzo@itelsasas.com",
  t5: "mcsotgiu@itelsasas.com",
  t6: "arquitectura@itelsasas.com",
  t7: "admin@itelsasas.com",
};

export const PROYECTO_COLORS = [
  "#378ADD",
  "#1D9E75",
  "#D85A30",
  "#BA7517",
  "#D4537E",
  "#639922",
  "#7F77DD",
];

// Credenciales públicas de EmailJS (igual que la apiKey de Firebase: la key
// pública no es secreta, EmailJS está diseñado para usarse client-side).
export const EMAILJS_SERVICE = "service_iiezjat";
export const EMAILJS_TEMPLATE = "template_2a3f9an";
export const EMAILJS_KEY = "vxumSVBkPuWUz8sy8";

export function teamMemberById(id: string): TeamMember | undefined {
  return TEAM.find((m) => m.id === id);
}

// localStorage: identidad elegida en el selector "¿Quién sos?", igual que el
// original (no es autenticación real, es solo "quién está usando esta sesión
// del módulo" para asignar tareas y excluirte de tus propias notificaciones).
export const PROYECTOS_IDENTITY_KEY = "payflow_proyectos_quien_sos";
