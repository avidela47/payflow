import mongoose, { Schema, models, model, Model } from "mongoose";

// Vault de credenciales — ver ARCHITECTURE.md sección 4. El valor nunca se
// guarda en texto plano: se cifra con AES-256-GCM antes de llegar acá
// (ver src/lib/crypto.ts).
export interface IVaultEntry {
  _id: mongoose.Types.ObjectId;
  service: string;
  username?: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  link?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VaultEntrySchema = new Schema<IVaultEntry>(
  {
    service: { type: String, required: true },
    username: String,
    encryptedValue: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    link: String,
    notes: String,
  },
  { timestamps: true }
);

export const VaultEntry =
  (models.VaultEntry as Model<IVaultEntry>) || model<IVaultEntry>("VaultEntry", VaultEntrySchema);

export interface IVaultAccessLog {
  _id: mongoose.Types.ObjectId;
  vaultEntry: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  action: "VIEW" | "REVEAL" | "EDIT" | "CREATE" | "DELETE";
  createdAt: Date;
}

const VaultAccessLogSchema = new Schema<IVaultAccessLog>({
  vaultEntry: { type: Schema.Types.ObjectId, ref: "VaultEntry", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, enum: ["VIEW", "REVEAL", "EDIT", "CREATE", "DELETE"], required: true },
  createdAt: { type: Date, default: Date.now },
});

export const VaultAccessLog =
  (models.VaultAccessLog as Model<IVaultAccessLog>) ||
  model<IVaultAccessLog>("VaultAccessLog", VaultAccessLogSchema);

// Otorga acceso puntual a una entrada del vault a alguien que no es OWNER.
export interface IVaultGrant {
  _id: mongoose.Types.ObjectId;
  vaultEntry: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  grantedAt: Date;
}

const VaultGrantSchema = new Schema<IVaultGrant>({
  vaultEntry: { type: Schema.Types.ObjectId, ref: "VaultEntry", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  grantedAt: { type: Date, default: Date.now },
});

VaultGrantSchema.index({ vaultEntry: 1, user: 1 }, { unique: true });

export const VaultGrant =
  (models.VaultGrant as Model<IVaultGrant>) || model<IVaultGrant>("VaultGrant", VaultGrantSchema);