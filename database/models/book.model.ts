import { IBook } from "@/types";
import{ Document, model, models, Schema } from "mongoose";


const BookSchema = new Schema<IBook>({
    clerkId: { type:String, required:true },
    title: { type:String, required:true },
    slug: { type:String, required:true, unique:true, lowercase:true, trim:true },
    author: { type:String, required:true },
    persona: { type:String },
    fileURL: { type:String, required:true },
    fileBlobKey: { type:String, required:true },
    coverURL: { type:String },
    coverBlobKey: { type:String },
    fileSize: { type:Number, required:true },
    totalSegments: { type:Number, default:0 },
}, { timestamps:true });

//To prevent duplicate model registration in development with hot reloading
const Book = models.Book || model<IBook>('Book', BookSchema);

export default Book;


    
