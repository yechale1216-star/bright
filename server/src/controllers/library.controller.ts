import { Request, Response } from 'express';
import { LibraryService } from '../services/library.service';

export class LibraryController {
  static async getBooks(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, page, limit } = req.query;
      const result = await LibraryService.getBooks({
        category: category as string,
        search: search as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch books' });
    }
  }

  static async getBookById(req: Request, res: Response): Promise<void> {
    try {
      const book = await LibraryService.getBookById(req.params.id);
      res.json({ success: true, data: book });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message || 'Book not found' });
    }
  }

  static async createBook(req: Request, res: Response): Promise<void> {
    try {
      const book = await LibraryService.createBook(req.body);
      res.status(201).json({ success: true, data: book });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to create book' });
    }
  }

  static async updateBook(req: Request, res: Response): Promise<void> {
    try {
      const book = await LibraryService.updateBook(req.params.id, req.body);
      res.json({ success: true, data: book });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to update book' });
    }
  }

  static async deleteBook(req: Request, res: Response): Promise<void> {
    try {
      await LibraryService.deleteBook(req.params.id);
      res.json({ success: true, message: 'Book deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to delete book' });
    }
  }

  static async borrowBook(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const record = await LibraryService.borrowBook({
        ...req.body,
        issuedById: user?.id,
      });
      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to borrow book' });
    }
  }

  static async returnBook(req: Request, res: Response): Promise<void> {
    try {
      const { notes } = req.body;
      const record = await LibraryService.returnBook(req.params.borrowId, notes);
      res.json({ success: true, data: record });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to return book' });
    }
  }

  static async getBorrowRecords(req: Request, res: Response): Promise<void> {
    try {
      const { status, studentId, userId, bookId } = req.query;
      const records = await LibraryService.getBorrowRecords({
        status: status as string,
        studentId: studentId as string,
        userId: userId as string,
        bookId: bookId as string,
      });
      res.json({ success: true, data: records });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch borrow records' });
    }
  }

  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await LibraryService.getLibraryStats();
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch library stats' });
    }
  }
}
