import prisma from '../config/db';

export interface BookInput {
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  publisher?: string;
  publicationYear?: number;
  totalCopies?: number;
  availableCopies?: number;
  shelfLocation?: string;
  description?: string;
  coverUrl?: string;
}

export interface BorrowInput {
  bookId: string;
  studentId?: string;
  userId?: string;
  dueDate: string | Date;
  issuedById?: string;
  notes?: string;
}

export class LibraryService {
  // ── Book CRUD ─────────────────────────────────────────────────────────────

  static async getBooks(params: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { category, search, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category && category !== 'ALL') {
      where.category = { equals: category, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
        include: {
          _count: {
            select: {
              borrowRecords: {
                where: { status: 'BORROWED' },
              },
            },
          },
        },
      }),
    ]);

    return { total, page, limit, books };
  }

  static async getBookById(id: string) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        borrowRecords: {
          orderBy: { borrowDate: 'desc' },
          take: 10,
          include: {
            student: { select: { id: true, fullName: true, student_id: true } },
            user: { select: { id: true, full_name: true, role: true } },
          },
        },
      },
    });
    if (!book) throw new Error('Book not found');
    return book;
  }

  static async createBook(data: BookInput) {
    const totalCopies = data.totalCopies ?? 1;
    const availableCopies = data.availableCopies ?? totalCopies;

    return prisma.book.create({
      data: {
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        category: data.category || 'General',
        publisher: data.publisher,
        publicationYear: data.publicationYear ? Number(data.publicationYear) : undefined,
        totalCopies,
        availableCopies,
        shelfLocation: data.shelfLocation,
        description: data.description,
        coverUrl: data.coverUrl,
      },
    });
  }

  static async updateBook(id: string, data: Partial<BookInput>) {
    return prisma.book.update({
      where: { id },
      data: {
        ...data,
        publicationYear: data.publicationYear != null ? Number(data.publicationYear) : undefined,
        totalCopies: data.totalCopies != null ? Number(data.totalCopies) : undefined,
        availableCopies: data.availableCopies != null ? Number(data.availableCopies) : undefined,
      },
    });
  }

  static async deleteBook(id: string) {
    return prisma.book.delete({ where: { id } });
  }

  // ── Borrow & Return ───────────────────────────────────────────────────────

  static async borrowBook(data: BorrowInput) {
    if (!data.studentId && !data.userId) {
      throw new Error('Must provide either studentId or userId to borrow a book');
    }

    let resolvedStudentId = data.studentId;
    if (data.studentId) {
      const student = await prisma.student.findFirst({
        where: {
          OR: [
            { id: data.studentId },
            { student_id: data.studentId },
          ],
        },
        select: { id: true },
      });
      if (!student) {
        throw new Error(`Student with ID "${data.studentId}" not found`);
      }
      resolvedStudentId = student.id;
    }

    const book = await prisma.book.findUnique({ where: { id: data.bookId } });
    if (!book) throw new Error('Book not found');
    if (book.availableCopies <= 0) {
      throw new Error('No available copies of this book currently in stock');
    }

    return prisma.$transaction(async (tx) => {
      // Create borrow record
      const record = await tx.bookBorrowRecord.create({
        data: {
          bookId: data.bookId,
          studentId: resolvedStudentId || undefined,
          userId: data.userId || undefined,
          dueDate: new Date(data.dueDate),
          issuedById: data.issuedById,
          notes: data.notes,
          status: 'BORROWED',
        },
        include: {
          book: true,
          student: { select: { id: true, fullName: true, student_id: true } },
          user: { select: { id: true, full_name: true, role: true } },
        },
      });

      // Decrement available copies
      await tx.book.update({
        where: { id: data.bookId },
        data: { availableCopies: { decrement: 1 } },
      });

      return record;
    });
  }

  static async returnBook(borrowRecordId: string, notes?: string) {
    const record = await prisma.bookBorrowRecord.findUnique({
      where: { id: borrowRecordId },
    });
    if (!record) throw new Error('Borrow record not found');
    if (record.status === 'RETURNED') throw new Error('Book has already been returned');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.bookBorrowRecord.update({
        where: { id: borrowRecordId },
        data: {
          status: 'RETURNED',
          returnDate: new Date(),
          notes: notes || record.notes,
        },
        include: {
          book: true,
          student: { select: { id: true, fullName: true, student_id: true } },
          user: { select: { id: true, full_name: true, role: true } },
        },
      });

      // Increment available copies
      await tx.book.update({
        where: { id: record.bookId },
        data: { availableCopies: { increment: 1 } },
      });

      return updated;
    });
  }

  static async getBorrowRecords(params: {
    status?: string;
    studentId?: string;
    userId?: string;
    bookId?: string;
  } = {}) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.studentId) where.studentId = params.studentId;
    if (params.userId) where.userId = params.userId;
    if (params.bookId) where.bookId = params.bookId;

    const records = await prisma.bookBorrowRecord.findMany({
      where,
      orderBy: { borrowDate: 'desc' },
      include: {
        book: true,
        student: { select: { id: true, fullName: true, student_id: true, grade: { select: { name: true } }, section: { select: { name: true } } } },
        user: { select: { id: true, full_name: true, role: true } },
      },
    });

    // Check overdue on the fly
    const now = new Date();
    return records.map((r) => {
      const isOverdue = r.status === 'BORROWED' && new Date(r.dueDate) < now;
      return {
        ...r,
        isOverdue,
      };
    });
  }

  static async getLibraryStats() {
    const [totalBooks, uniqueTitles, activeBorrows, overdueBorrows] = await Promise.all([
      prisma.book.aggregate({ _sum: { totalCopies: true } }),
      prisma.book.count(),
      prisma.bookBorrowRecord.count({ where: { status: 'BORROWED' } }),
      prisma.bookBorrowRecord.count({
        where: {
          status: 'BORROWED',
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      totalCopies: totalBooks._sum.totalCopies ?? 0,
      uniqueTitles,
      activeBorrows,
      overdueBorrows,
    };
  }
}
