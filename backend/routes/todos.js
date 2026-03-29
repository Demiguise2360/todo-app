const router = require('express').Router();
const auth = require('../middleware/auth');
const Todo = require('../models/Todo');
const PDFDocument = require('pdfkit');

// Get all todos (active)
router.get('/', auth, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user._id, completed: false })
      .sort({ dueDate: 1, createdAt: 1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ message: 'Fehler beim Laden', error: err.message });
  }
});

// Get completed todos
router.get('/completed', auth, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user._id, completed: true })
      .sort({ completedAt: -1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ message: 'Fehler beim Laden', error: err.message });
  }
});

// Get todos with date (for calendar) - all todos with a dueDate
router.get('/calendar', auth, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user._id, dueDate: { $ne: null } })
      .sort({ dueDate: 1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ message: 'Fehler beim Laden', error: err.message });
  }
});

// Create todo
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, dueDate, hasTime } = req.body;
    if (!title) return res.status(400).json({ message: 'Titel ist erforderlich' });

    const todo = await Todo.create({
      user: req.user._id,
      title,
      description: description || '',
      dueDate: dueDate || null,
      hasTime: hasTime || false
    });
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({ message: 'Fehler beim Erstellen', error: err.message });
  }
});

// Update todo
router.put('/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    if (!todo) return res.status(404).json({ message: 'Todo nicht gefunden' });

    const { title, description, dueDate, hasTime } = req.body;
    if (title !== undefined) todo.title = title;
    if (description !== undefined) todo.description = description;
    if (dueDate !== undefined) todo.dueDate = dueDate;
    if (hasTime !== undefined) todo.hasTime = hasTime;

    await todo.save();
    res.json(todo);
  } catch (err) {
    res.status(500).json({ message: 'Fehler beim Aktualisieren', error: err.message });
  }
});

// Complete todo
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    if (!todo) return res.status(404).json({ message: 'Todo nicht gefunden' });

    todo.completed = true;
    todo.completedAt = new Date();
    await todo.save();
    res.json(todo);
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// Restore todo
router.patch('/:id/restore', auth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    if (!todo) return res.status(404).json({ message: 'Todo nicht gefunden' });

    todo.completed = false;
    todo.completedAt = null;
    await todo.save();
    res.json(todo);
  } catch (err) {
    res.status(500).json({ message: 'Fehler', error: err.message });
  }
});

// Delete todo
router.delete('/:id', auth, async (req, res) => {
  try {
    await Todo.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Gelöscht' });
  } catch (err) {
    res.status(500).json({ message: 'Fehler beim Löschen', error: err.message });
  }
});

// Export PDF
router.get('/export/pdf', auth, async (req, res) => {
  try {
    const { type = 'active' } = req.query;
    const filter = { user: req.user._id };
    if (type === 'completed') filter.completed = true;
    else filter.completed = false;

    const todos = await Todo.find(filter).sort({ dueDate: 1, createdAt: 1 });

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true, autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="todos-${type}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const dateStr = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Header banner
    doc.rect(0, 0, pageW, 80).fill('#1e40af');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24)
       .text('Todo Checkliste', 50, 22, { align: 'left', lineBreak: false });

    const subtitle = type === 'completed' ? 'Erledigte Aufgaben' : 'Offene Aufgaben';
    doc.fontSize(11).font('Helvetica')
       .text(subtitle, 50, 52, { lineBreak: false });
    doc.text(dateStr, 0, 52, { align: 'right', width: pageW - 50, lineBreak: false });

    doc.fillColor('#1e293b');

    if (todos.length === 0) {
      doc.fontSize(14).fillColor('#64748b').text('Keine Aufgaben vorhanden.', 50, 120);
    } else {
      let y = 105;
      todos.forEach((todo, i) => {
        const rowH = todo.description ? 78 : 52;
        if (y + rowH > pageH - 60) {
          doc.addPage();
          y = 40;
        }

        // Row background
        if (i % 2 === 0) {
          doc.rect(40, y - 6, pageW - 80, rowH).fill('#f0f9ff').stroke('#e0f2fe');
        }

        // Checkbox
        doc.rect(55, y + 4, 15, 15).strokeColor('#1e40af').lineWidth(1.5).stroke();
        if (todo.completed) {
          doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(11)
             .text('✓', 57, y + 5, { lineBreak: false });
        }

        // Title
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13)
           .text(todo.title, 85, y + 4, { width: pageW - 220, lineBreak: false });

        // Due date (right aligned)
        if (todo.dueDate) {
          const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
          if (todo.hasTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
          const dueStr = new Date(todo.dueDate).toLocaleString('de-CH', opts);
          doc.fillColor('#2563eb').font('Helvetica').fontSize(9)
             .text(dueStr, pageW - 180, y + 6, { width: 135, align: 'right', lineBreak: false });
        }

        // Description
        if (todo.description) {
          doc.fillColor('#475569').font('Helvetica').fontSize(10)
             .text(todo.description, 85, y + 24, { width: pageW - 170, height: 28, ellipsis: true, lineBreak: true });
        }

        y += rowH + 4;
      });
    }

    // Footer on every page — use buffered pages
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#94a3b8')
         .text(
           `Taskira Export · ${dateStr} · ${todos.length} Aufgabe(n) · Seite ${i + 1} von ${pageCount}`,
           40, pageH - 30, { align: 'center', width: pageW - 80, lineBreak: false }
         );
    }

    doc.flushPages();
    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'PDF-Fehler', error: err.message });
  }
});

module.exports = router;
