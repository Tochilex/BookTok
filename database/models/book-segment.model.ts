//This model helps split the pdf into smaller segments for better processing and interaction. 
// Each segment corresponds to a portion of the book, allowing for efficient retrieval and display during the interactive reading experience.

import { IBookSegment } from "@/types";
import {  model, models, Schema } from "mongoose";


const BookSegmentSchema = new Schema<IBookSegment>({
    clerkId: { type: String, required: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    content: { type: String, required: true },
    segmentIndex: { type: Number, required: true, index: true },
    pageNumber: { type: Number, index: true },
    wordCount: { type: Number, required: true },
}, { timestamps: true });

BookSegmentSchema.index({ bookId: 1, segmentIndex: 1 }); // Compound index for efficient retrieval of segments in order
BookSegmentSchema.index({ bookId: 1, pageNumber: 1 }); // Index for efficient retrieval of segments by page number
BookSegmentSchema.index({ bookId: 1, content: 'text' }); // Text index for full-text search within segments

//To prevent duplicate model registration in development with hot reloading
const BookSegment = models.BookSegment || model<IBookSegment>('BookSegment', BookSegmentSchema);

export default BookSegment;
