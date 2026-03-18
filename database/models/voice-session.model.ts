import { IVoiceSession } from "@/types";
import {  model, models, Schema } from "mongoose";


const VoiceSessionSchema = new Schema<IVoiceSession>({
    clerkId: { type: String, required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    durationSeconds: { type: Number, default: 0, required: true },
    billingPeriodStart: { type: Date, required: true, index: true }, // For billing purposes, we track the start of the billing period (e.g., month) to easily aggregate usage
}, { timestamps: true });

VoiceSessionSchema.index({ clerkId: 1, billingPeriodStart: 1 }); // Index for efficient retrieval of voice sessions by book and start time

//To prevent duplicate model registration in development with hot reloading
const VoiceSession = models.VoiceSession || model<IVoiceSession>('VoiceSession', VoiceSessionSchema);

export default VoiceSession;
