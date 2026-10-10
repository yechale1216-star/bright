import { Router } from 'express';
import { LibraryController } from '../controllers/library.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Stats (Admin and Librarian)
router.get('/stats', authorize(['admin', 'school_admin', 'super_admin', 'librarian']), LibraryController.getStats);

// Borrow records & circulation desk
router.get('/borrows', authorize(['admin', 'school_admin', 'super_admin', 'librarian']), LibraryController.getBorrowRecords);
router.post('/borrow', authorize(['admin', 'school_admin', 'super_admin', 'librarian']), LibraryController.borrowBook);
router.post('/return/:borrowId', authorize(['admin', 'school_admin', 'super_admin', 'librarian']), LibraryController.returnBook);

// Books catalogue
router.get('/books', LibraryController.getBooks);
router.get('/books/:id', LibraryController.getBookById);
router.post('/books', authorize(['admin', 'school_admin', 'librarian']), LibraryController.createBook);
router.put('/books/:id', authorize(['admin', 'school_admin', 'librarian']), LibraryController.updateBook);
router.delete('/books/:id', authorize(['admin', 'school_admin', 'librarian']), LibraryController.deleteBook);

export default router;
