'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Bookmark,
  Layers,
  ArrowRightLeft,
  Calendar,
  Save,
  Filter,
} from 'lucide-react';
import {
  libraryClientService,
  Book,
  BookBorrowRecord,
  LibraryStats,
} from '@/lib/facilities-service';
import { notifications } from '@/lib/utils/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const CATEGORIES = ['ALL', 'Science', 'Mathematics', 'Literature', 'History', 'Technology', 'Reference', 'General'];

export default function AdminLibraryPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'borrows'>('catalog');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<LibraryStats>({
    totalCopies: 0,
    uniqueTitles: 0,
    activeBorrows: 0,
    overdueBorrows: 0,
  });

  // Catalog State
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Borrow Records State
  const [borrowRecords, setBorrowRecords] = useState<BookBorrowRecord[]>([]);
  const [borrowStatusFilter, setBorrowStatusFilter] = useState<'ALL' | 'BORROWED' | 'RETURNED' | 'OVERDUE'>('ALL');

  // Book Modal
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    category: 'General',
    publisher: '',
    publicationYear: '',
    totalCopies: 1,
    shelfLocation: '',
    description: '',
  });

  // Borrow Modal
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [selectedBookForBorrow, setSelectedBookForBorrow] = useState<Book | null>(null);
  const [borrowForm, setBorrowForm] = useState({
    studentId: '',
    dueDate: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, booksData, borrowsData] = await Promise.all([
        libraryClientService.getStats().catch(() => ({ totalCopies: 0, uniqueTitles: 0, activeBorrows: 0, overdueBorrows: 0 })),
        libraryClientService.getBooks({ category: selectedCategory !== 'ALL' ? selectedCategory : undefined }),
        libraryClientService.getBorrowRecords(),
      ]);
      setStats(statsData);
      setBooks(booksData);
      setBorrowRecords(borrowsData);
    } catch {
      notifications.error('Error', 'Failed to load library data');
    } finally {
      setLoading(false);
    }
  };

  const filteredBooks = useMemo(() => {
    if (!searchQuery) return books;
    const q = searchQuery.toLowerCase();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.isbn && b.isbn.toLowerCase().includes(q))
    );
  }, [books, searchQuery]);

  const filteredBorrows = useMemo(() => {
    if (borrowStatusFilter === 'ALL') return borrowRecords;
    if (borrowStatusFilter === 'OVERDUE') return borrowRecords.filter((r) => r.isOverdue);
    return borrowRecords.filter((r) => r.status === borrowStatusFilter);
  }, [borrowRecords, borrowStatusFilter]);

  // Book CRUD
  const handleSaveBook = async () => {
    if (!bookForm.title || !bookForm.author) {
      notifications.error('Validation Error', 'Title and Author are required');
      return;
    }
    try {
      if (editingBook) {
        await libraryClientService.updateBook(editingBook.id, {
          ...bookForm,
          totalCopies: Number(bookForm.totalCopies),
          publicationYear: bookForm.publicationYear ? Number(bookForm.publicationYear) : undefined,
        });
        notifications.success('Success', 'Book updated successfully');
      } else {
        await libraryClientService.createBook({
          ...bookForm,
          totalCopies: Number(bookForm.totalCopies),
          availableCopies: Number(bookForm.totalCopies),
          publicationYear: bookForm.publicationYear ? Number(bookForm.publicationYear) : undefined,
        });
        notifications.success('Success', 'Book added to catalog');
      }
      setBookModalOpen(false);
      setEditingBook(null);
      resetBookForm();
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to save book');
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Are you sure you want to remove this book from the catalog?')) return;
    try {
      await libraryClientService.deleteBook(id);
      notifications.success('Success', 'Book removed');
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to delete book');
    }
  };

  const openEditBook = (book: Book) => {
    setEditingBook(book);
    setBookForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      category: book.category,
      publisher: book.publisher || '',
      publicationYear: book.publicationYear ? String(book.publicationYear) : '',
      totalCopies: book.totalCopies,
      shelfLocation: book.shelfLocation || '',
      description: book.description || '',
    });
    setBookModalOpen(true);
  };

  const resetBookForm = () => {
    setBookForm({
      title: '',
      author: '',
      isbn: '',
      category: 'General',
      publisher: '',
      publicationYear: '',
      totalCopies: 1,
      shelfLocation: '',
      description: '',
    });
  };

  // Borrow / Return
  const openBorrowModal = (book: Book) => {
    setSelectedBookForBorrow(book);
    // Default due date to 14 days from today
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    setBorrowForm({
      studentId: '',
      dueDate: twoWeeks.toISOString().substring(0, 10),
      notes: '',
    });
    setBorrowModalOpen(true);
  };

  const handleBorrow = async () => {
    if (!selectedBookForBorrow || !borrowForm.dueDate) {
      notifications.error('Validation Error', 'Please specify a due date');
      return;
    }
    if (!borrowForm.studentId) {
      notifications.error('Validation Error', 'Please enter a Student ID or Select Student');
      return;
    }
    try {
      await libraryClientService.borrowBook({
        bookId: selectedBookForBorrow.id,
        studentId: borrowForm.studentId,
        dueDate: borrowForm.dueDate,
        notes: borrowForm.notes,
      });
      notifications.success('Success', 'Book checked out successfully');
      setBorrowModalOpen(false);
      setSelectedBookForBorrow(null);
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to check out book');
    }
  };

  const handleReturn = async (borrowId: string) => {
    try {
      await libraryClientService.returnBook(borrowId);
      notifications.success('Success', 'Book marked as returned');
      loadData();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to return book');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
              <BookOpen className="w-7 h-7" />
            </div>
            Library Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Catalog books, track inventory, and manage student borrowing records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditingBook(null);
              resetBookForm();
              setBookModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md gap-2"
          >
            <Plus className="w-4 h-4" /> Add Book
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Copies</p>
            <p className="text-xl font-bold text-foreground">{stats.totalCopies}</p>
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Titles</p>
            <p className="text-xl font-bold text-foreground">{stats.uniqueTitles}</p>
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Checked Out</p>
            <p className="text-xl font-bold text-foreground">{stats.activeBorrows}</p>
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Overdue</p>
            <p className="text-xl font-bold text-rose-500">{stats.overdueBorrows}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/70 gap-2">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'border-indigo-500 text-indigo-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Book Catalog ({filteredBooks.length})
        </button>
        <button
          onClick={() => setActiveTab('borrows')}
          className={`pb-3 px-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'borrows'
              ? 'border-indigo-500 text-indigo-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" /> Borrowing Desk ({borrowRecords.length})
        </button>
      </div>

      {/* Catalog View */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, author, ISBN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl bg-card border-border/80"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-card border border-border/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Book Grid */}
          {loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border/70 rounded-2xl text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No books found in this view</p>
              <p className="text-xs mt-1">Add a book to start populating your library catalog.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-card border border-border/80 rounded-2xl p-5 hover:border-indigo-500/40 transition-all flex flex-col justify-between shadow-sm group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        {book.category}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          book.availableCopies > 0
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {book.availableCopies} / {book.totalCopies} Available
                      </span>
                    </div>

                    <h3 className="font-bold text-foreground text-base line-clamp-1">{book.title}</h3>
                    <p className="text-xs text-muted-foreground mb-3">By {book.author}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3 bg-secondary/30 rounded-xl p-2.5">
                      <div>
                        <span className="block font-medium text-[11px] text-muted-foreground/80">Shelf</span>
                        <span className="text-foreground font-semibold">{book.shelfLocation || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block font-medium text-[11px] text-muted-foreground/80">ISBN</span>
                        <span className="text-foreground font-semibold">{book.isbn || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                    <Button
                      size="sm"
                      onClick={() => openBorrowModal(book)}
                      disabled={book.availableCopies <= 0}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl disabled:opacity-40"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Check Out
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditBook(book)}
                      className="p-2 text-muted-foreground hover:text-indigo-500 rounded-xl"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteBook(book.id)}
                      className="p-2 text-muted-foreground hover:text-rose-500 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Borrow Desk View */}
      {activeTab === 'borrows' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['ALL', 'BORROWED', 'OVERDUE', 'RETURNED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setBorrowStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  borrowStatusFilter === st
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-card border border-border/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase border-b border-border/60">
                  <tr>
                    <th className="p-3.5 pl-5">Book Title</th>
                    <th className="p-3.5">Borrower</th>
                    <th className="p-3.5">Borrowed Date</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right pr-5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBorrows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                        No borrowing records in this filter
                      </td>
                    </tr>
                  ) : (
                    filteredBorrows.map((r) => (
                      <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3.5 pl-5 font-semibold text-foreground">
                          {r.book?.title || 'Unknown'}
                          <span className="block text-xs font-normal text-muted-foreground">{r.book?.author}</span>
                        </td>
                        <td className="p-3.5">
                          <p className="font-medium text-foreground">{r.student?.fullName || r.user?.full_name || 'Member'}</p>
                          <p className="text-xs text-muted-foreground">{r.student?.student_id || r.user?.role}</p>
                        </td>
                        <td className="p-3.5 text-xs text-muted-foreground">
                          {new Date(r.borrowDate).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 text-xs font-medium">
                          <span className={r.isOverdue ? 'text-rose-500 font-bold' : 'text-foreground'}>
                            {new Date(r.dueDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {r.status === 'RETURNED' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Returned
                            </span>
                          ) : r.isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-md">
                              <Clock className="w-3.5 h-3.5" /> Checked Out
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right pr-5">
                          {r.status === 'BORROWED' && (
                            <Button
                              size="sm"
                              onClick={() => handleReturn(r.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl shadow-sm"
                            >
                              Return Book
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Book Add/Edit Modal */}
      <Dialog open={bookModalOpen} onOpenChange={setBookModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingBook ? 'Edit Book' : 'Add Book to Catalog'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Book Title *</Label>
              <Input
                value={bookForm.title}
                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                placeholder="e.g. Ethiopian History & Heritage"
                className="rounded-xl mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Author *</Label>
                <Input
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  placeholder="Author name"
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <select
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  className="w-full mt-1 bg-card border border-border rounded-xl text-sm px-3 py-2 text-foreground"
                >
                  {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">ISBN</Label>
                <Input
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  placeholder="978-..."
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total Copies</Label>
                <Input
                  type="number"
                  min="1"
                  value={bookForm.totalCopies}
                  onChange={(e) => setBookForm({ ...bookForm, totalCopies: Number(e.target.value) })}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Shelf / Location</Label>
                <Input
                  value={bookForm.shelfLocation}
                  onChange={(e) => setBookForm({ ...bookForm, shelfLocation: e.target.value })}
                  placeholder="e.g. Shelf A-3"
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Publisher</Label>
                <Input
                  value={bookForm.publisher}
                  onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                  placeholder="Publisher name"
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBookModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBook} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              <Save className="w-4 h-4 mr-1" /> {editingBook ? 'Update Book' : 'Add to Catalog'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check Out Modal */}
      <Dialog open={borrowModalOpen} onOpenChange={setBorrowModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Check Out Book: {selectedBookForBorrow?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Student ID or System ID *</Label>
              <Input
                value={borrowForm.studentId}
                onChange={(e) => setBorrowForm({ ...borrowForm, studentId: e.target.value })}
                placeholder="Enter Student UUID or ID"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Due Date *</Label>
              <Input
                type="date"
                value={borrowForm.dueDate}
                onChange={(e) => setBorrowForm({ ...borrowForm, dueDate: e.target.value })}
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Remarks / Notes</Label>
              <Input
                value={borrowForm.notes}
                onChange={(e) => setBorrowForm({ ...borrowForm, notes: e.target.value })}
                placeholder="Optional notes"
                className="rounded-xl mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBorrowModalOpen(false)}>Cancel</Button>
            <Button onClick={handleBorrow} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
