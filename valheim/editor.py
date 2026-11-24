#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Валера — Редактор дорожной карты v2
Новая структура: категории + подкатегории, плоский список этапов,
автоматические версии по категориям.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime

# --- Пути -------------------------------------------------------------------
def get_base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_dir()
DATA_DIR = os.path.join(BASE_DIR, 'data')
PUBLISH_DIR = os.path.join(BASE_DIR, '..', '_publish', 'valheim')
PUBLISH_BAT = os.path.join(BASE_DIR, '..', 'publish.bat')
GIT = r'C:\Program Files\Git\cmd\git.exe'

# --- JSON -------------------------------------------------------------------
def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filename, data):
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# --- Данные -----------------------------------------------------------------
# categories.json: [{id, icon, name, visible, order, subcategories: [str]}]
# milestones.json: [{id, cat, subcat, text, status, date, doneDate, order}]
#   status: "done" | "wip" | "planned"
categories = []
milestones = []

def reload_data():
    global categories, milestones
    categories = load_json('categories.json')
    milestones = load_json('milestones.json')
    # Гарантируем subcategories у каждой категории
    for c in categories:
        if 'subcategories' not in c:
            c['subcategories'] = []

def save_all():
    save_json('categories.json', categories)
    save_json('milestones.json', milestones)

def next_id():
    """Следующий свободный числовой ID для этапа."""
    nums = []
    for m in milestones:
        mid = m.get('id', 0)
        if isinstance(mid, int):
            nums.append(mid)
        elif isinstance(mid, str):
            match = re.search(r'(\d+)$', mid)
            if match:
                nums.append(int(match.group(1)))
    return max(nums, default=0) + 1

def cat_version(cat_id):
    """Версия категории: кол-во выполненных * 0.1."""
    count = sum(1 for m in milestones if m.get('cat') == cat_id and m.get('status') == 'done')
    return round(count * 0.1, 1)

def get_subcats(cat_id):
    """Подкатегории для категории."""
    c = next((x for x in categories if x['id'] == cat_id), None)
    if c:
        return c.get('subcategories', [])
    return []

# --- Цвета темы ------------------------------------------------------------
BG   = '#0d1117'
BG2  = '#161b22'
BG3  = '#21262d'
FG   = '#e6edf3'
FG2  = '#8b949e'
ACCENT = '#58a6ff'
GREEN  = '#4ade80'
YELLOW = '#f0ad4e'
RED    = '#f85149'
BORDER = '#30363d'

STATUS_ICON = {'done': '[+]', 'wip': '[~]', 'planned': '[ ]'}
STATUS_LABEL = {'done': 'Выполнено', 'wip': 'В работе', 'planned': 'В планах'}

# --- Главное окно -----------------------------------------------------------
class EditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Валера — Редактор дорожной карты v2')
        self.geometry('1150x750')
        self.configure(bg=BG)
        self.minsize(900, 550)

        reload_data()
        self._apply_styles()

        # Notebook
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill='both', expand=True, padx=8, pady=(8, 0))

        self.tab_roadmap = ttk.Frame(self.notebook)
        self.tab_categories = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_roadmap, text='  Дорожная карта  ')
        self.notebook.add(self.tab_categories, text='  Категории  ')

        self._build_roadmap_tab()
        self._build_categories_tab()

        # Нижняя панель версий
        ver_frame = tk.Frame(self, bg=BG2, bd=1, relief='solid')
        ver_frame.pack(fill='x', padx=8, pady=(4, 0))
        self.ver_label = tk.Label(ver_frame, text='', bg=BG2, fg=ACCENT,
                                  font=('Segoe UI', 9), anchor='w')
        self.ver_label.pack(fill='x', padx=8, pady=4)

        # Кнопки
        bottom = tk.Frame(self, bg=BG, height=48)
        bottom.pack(fill='x', padx=8, pady=8)
        ttk.Button(bottom, text='Сохранить все', style='Accent.TButton',
                   command=self._save_all).pack(side='left', padx=(0, 8))
        ttk.Button(bottom, text='Перезагрузить', command=self._reload).pack(side='left', padx=(0, 8))
        ttk.Button(bottom, text='Опубликовать на сайт', style='Green.TButton',
                   command=self._publish).pack(side='right')
        self._status_var = tk.StringVar(value='Готово')
        tk.Label(bottom, textvariable=self._status_var, bg=BG, fg=FG2,
                 font=('Segoe UI', 9)).pack(side='right', padx=16)

        # Если нет этапов "В работе", показать все
        has_wip = any(m.get('status') == 'wip' for m in milestones)
        if not has_wip:
            self.filter_status_var.set('Все')

        self._refresh_all()

    # --- Стили --------------------------------------------------------------
    def _apply_styles(self):
        s = ttk.Style()
        s.theme_use('clam')
        s.configure('.', background=BG, foreground=FG, fieldbackground=BG2,
                    bordercolor=BORDER, darkcolor=BG, lightcolor=BG)
        s.configure('TNotebook', background=BG, borderwidth=0)
        s.configure('TNotebook.Tab', background=BG2, foreground=FG,
                    padding=[12, 6], font=('Segoe UI', 10))
        s.map('TNotebook.Tab', background=[('selected', BG3)], foreground=[('selected', ACCENT)])
        s.configure('TFrame', background=BG)
        s.configure('TLabel', background=BG, foreground=FG, font=('Segoe UI', 9))
        s.configure('TButton', background=BG2, foreground=FG,
                    font=('Segoe UI', 9, 'bold'), borderwidth=1, relief='solid')
        s.map('TButton', background=[('active', BG3)])
        s.configure('Accent.TButton', background='#1f6feb', foreground='#fff')
        s.map('Accent.TButton', background=[('active', '#388bfd')])
        s.configure('Danger.TButton', background='#da3633', foreground='#fff')
        s.map('Danger.TButton', background=[('active', '#f85149')])
        s.configure('Green.TButton', background='#238636', foreground='#fff')
        s.map('Green.TButton', background=[('active', '#2ea043')])
        s.configure('Treeview', background=BG2, foreground=FG, fieldbackground=BG2,
                    font=('Segoe UI', 9), rowheight=28, borderwidth=0)
        s.configure('Treeview.Heading', background=BG3, foreground=ACCENT,
                    font=('Segoe UI', 9, 'bold'))
        s.map('Treeview', background=[('selected', '#1f6feb')],
              foreground=[('selected', '#fff')])
        s.configure('TEntry', fieldbackground=BG2, foreground=FG,
                    insertcolor=FG, borderwidth=1, relief='solid')
        s.configure('TCheckbutton', background=BG, foreground=FG)
        s.configure('TCombobox', fieldbackground=BG2, foreground=FG,
                    selectbackground='#1f6feb', selectforeground='#fff')

    # === Дорожная карта =====================================================
    def _build_roadmap_tab(self):
        f = self.tab_roadmap

        # Фильтры
        filt = tk.Frame(f, bg=BG)
        filt.pack(fill='x', padx=8, pady=(8, 4))

        tk.Label(filt, text='Статус:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.filter_status_var = tk.StringVar(value='В работе')
        self.filter_status_combo = ttk.Combobox(filt, textvariable=self.filter_status_var,
                                                 state='readonly', font=('Segoe UI', 9), width=14)
        self.filter_status_combo['values'] = ['Все', 'В работе', 'В планах', 'Выполнено']
        self.filter_status_combo.pack(side='left', padx=6)
        self.filter_status_combo.bind('<<ComboboxSelected>>', lambda e: self._refresh_stages())

        tk.Label(filt, text='Категория:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left', padx=(12, 0))
        self.filter_var = tk.StringVar(value='Все')
        self.filter_combo = ttk.Combobox(filt, textvariable=self.filter_var,
                                          state='readonly', font=('Segoe UI', 9), width=25)
        self.filter_combo.pack(side='left', padx=6)
        self.filter_combo.bind('<<ComboboxSelected>>', lambda e: self._refresh_stages())

        # Левая часть: список этапов
        left = ttk.Frame(f)
        left.pack(side='left', fill='both', expand=True, padx=(8, 4), pady=(0, 8))

        ttk.Label(left, text='Этапы дорожной карты', font=('Segoe UI', 11, 'bold'),
                  foreground=ACCENT).pack(anchor='w')

        tree_frame = ttk.Frame(left)
        tree_frame.pack(fill='both', expand=True, pady=(6, 0))

        cols = ('status', 'cat', 'subcat', 'text', 'date', 'doneDate')
        self.stage_tree = ttk.Treeview(tree_frame, columns=cols, show='headings',
                                        selectmode='browse')
        self.stage_tree.heading('status', text='')
        self.stage_tree.heading('cat', text='Категория')
        self.stage_tree.heading('subcat', text='Подкатегория')
        self.stage_tree.heading('text', text='Описание')
        self.stage_tree.heading('date', text='Дата')
        self.stage_tree.heading('doneDate', text='Выполнено')
        self.stage_tree.column('status', width=32, minwidth=32, anchor='center')
        self.stage_tree.column('cat', width=120, minwidth=70)
        self.stage_tree.column('subcat', width=110, minwidth=60)
        self.stage_tree.column('text', width=280, minwidth=100)
        self.stage_tree.column('date', width=85, minwidth=60)
        self.stage_tree.column('doneDate', width=85, minwidth=60)

        sb = ttk.Scrollbar(tree_frame, orient='vertical', command=self.stage_tree.yview)
        self.stage_tree.configure(yscrollcommand=sb.set)
        self.stage_tree.pack(side='left', fill='both', expand=True)
        sb.pack(side='right', fill='y')

        self.stage_tree.bind('<<TreeviewSelect>>', self._on_stage_select)
        self.stage_tree.bind('<Double-1>', lambda e: self._edit_stage_dialog())

        btn_row = tk.Frame(left, bg=BG)
        btn_row.pack(fill='x', pady=(6, 0))
        ttk.Button(btn_row, text='+ Добавить этап', command=self._add_stage).pack(side='left')
        ttk.Button(btn_row, text='\u25b2', command=self._move_up, width=3).pack(side='left', padx=(12, 2))
        ttk.Button(btn_row, text='\u25bc', command=self._move_down, width=3).pack(side='left', padx=(2, 12))
        ttk.Button(btn_row, text='Удалить', style='Danger.TButton',
                   command=self._delete_stage).pack(side='left')

        # Правая часть: редактирование этапа
        right = ttk.Frame(f)
        right.pack(side='right', fill='both', padx=(4, 8), pady=(0, 8))
        right.configure(width=320)

        ef = tk.LabelFrame(right, text=' Редактирование этапа ', bg=BG, fg=ACCENT,
                           font=('Segoe UI', 10, 'bold'), bd=1, relief='solid',
                           highlightbackground=BORDER)
        ef.pack(fill='x')

        # Дата
        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=(10, 4))
        tk.Label(r, text='Дата:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.e_date = tk.Entry(r, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                               relief='solid', width=14, font=('Segoe UI', 9))
        self.e_date.pack(side='left', padx=6)

        # Категория
        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=4)
        tk.Label(r, text='Категория:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.e_cat_var = tk.StringVar()
        self.e_cat_combo = ttk.Combobox(r, textvariable=self.e_cat_var, state='readonly',
                                         font=('Segoe UI', 9), width=22)
        self.e_cat_combo.pack(side='left', padx=6)
        self.e_cat_combo.bind('<<ComboboxSelected>>', self._on_edit_cat_changed)

        # Подкатегория
        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=4)
        tk.Label(r, text='Подкатегория:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.e_subcat_var = tk.StringVar()
        self.e_subcat_combo = ttk.Combobox(r, textvariable=self.e_subcat_var,
                                            font=('Segoe UI', 9), width=22)
        self.e_subcat_combo.pack(side='left', padx=6)

        # Описание
        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=4)
        tk.Label(r, text='Описание:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(anchor='w')
        self.e_text = tk.Text(r, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                              relief='solid', font=('Segoe UI', 9), height=3, wrap='word')
        self.e_text.pack(fill='x', pady=(2, 0))

        # Статус
        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=6)
        tk.Label(r, text='Статус:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.e_status_var = tk.StringVar(value='planned')
        for val, label, color in [('done', 'Выполнено', GREEN),
                                   ('wip', 'В работе', YELLOW),
                                   ('planned', 'В планах', FG2)]:
            tk.Radiobutton(r, text=label, variable=self.e_status_var, value=val,
                           bg=BG, fg=color, selectcolor=BG2, activebackground=BG,
                           activeforeground=color, font=('Segoe UI', 9),
                           command=self._on_status_changed).pack(side='left', padx=(8, 0))

        # Дата выполнения
        self.done_date_frame = tk.Frame(ef, bg=BG)
        self.done_date_frame.pack(fill='x', padx=10, pady=4)
        tk.Label(self.done_date_frame, text='Дата выполнения:', bg=BG, fg=FG,
                 font=('Segoe UI', 9)).pack(side='left')
        self.e_done_date = tk.Entry(self.done_date_frame, bg=BG2, fg=FG,
                                     insertbackground=FG, bd=1, relief='solid',
                                     width=14, font=('Segoe UI', 9))
        self.e_done_date.pack(side='left', padx=6)

        # Кнопка сохранить
        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=(8, 10))
        ttk.Button(r, text='Сохранить этап', style='Accent.TButton',
                   command=self._save_stage).pack(side='left')

        self._editing_id = None  # ID текущего редактируемого этапа

    # --- Обновление списка этапов -------------------------------------------
    def _refresh_stages(self):
        self.stage_tree.delete(*self.stage_tree.get_children())

        # Обновляем фильтр
        cat_names = ['Все'] + [c['name'] for c in sorted(categories, key=lambda x: x.get('order', 0))]
        self.filter_combo['values'] = cat_names

        # Фильтр категории
        filt = self.filter_var.get()
        filt_id = None
        if filt != 'Все':
            c = next((x for x in categories if x['name'] == filt), None)
            if c:
                filt_id = c['id']

        # Фильтр статуса
        status_filter_map = {'В работе': 'wip', 'В планах': 'planned', 'Выполнено': 'done'}
        filt_status = status_filter_map.get(self.filter_status_var.get(), None)

        # Сортировка: сначала "в работе", потом "в планах", потом "выполнено"
        status_priority = {'wip': 0, 'planned': 1, 'done': 2}
        sorted_ms = sorted(milestones, key=lambda m: (
            status_priority.get(m.get('status', 'planned'), 1),
            m.get('order', 0)
        ))
        cat_map = {c['id']: c['name'] for c in categories}

        for m in sorted_ms:
            if filt_id and m.get('cat') != filt_id:
                continue
            if filt_status and m.get('status') != filt_status:
                continue
            status = STATUS_ICON.get(m.get('status', 'planned'), '\u2b1c')
            cat_name = cat_map.get(m.get('cat', ''), m.get('cat', ''))
            self.stage_tree.insert('', 'end', iid=str(m['id']),
                                   values=(status, cat_name, m.get('subcat', ''),
                                           m.get('text', ''), m.get('date', ''),
                                           m.get('doneDate', '')))

    def _refresh_versions(self):
        parts = []
        for c in sorted(categories, key=lambda x: x.get('order', 0)):
            v = cat_version(c['id'])
            if v > 0:
                parts.append(f"{c['name']} v{v}")
        total = sum(1 for m in milestones if m.get('status') == 'done')
        self.ver_label.config(text=f"Версии:  {' | '.join(parts)}     Всего выполнено: {total}/{len(milestones)}")

    def _refresh_edit_combos(self):
        cat_names = [f"{c['id']} \u2014 {c['name']}" for c in
                     sorted(categories, key=lambda x: x.get('order', 0))]
        self.e_cat_combo['values'] = cat_names

    def _refresh_all(self):
        self._refresh_edit_combos()
        self._refresh_stages()
        self._refresh_versions()
        self._refresh_categories()

    # --- Выбор этапа --------------------------------------------------------
    def _on_stage_select(self, event=None):
        sel = self.stage_tree.selection()
        if not sel:
            return
        sid = sel[0]
        m = next((x for x in milestones if str(x.get('id', '')) == sid), None)
        if not m:
            return

        self._editing_id = m['id']

        self.e_date.delete(0, 'end')
        self.e_date.insert(0, m.get('date', ''))

        # Категория
        cat_id = m.get('cat', '')
        for i, c in enumerate(sorted(categories, key=lambda x: x.get('order', 0))):
            if c['id'] == cat_id:
                self.e_cat_combo.current(i)
                break
        self._update_subcat_combo(cat_id)

        # Подкатегория
        self.e_subcat_var.set(m.get('subcat', ''))

        # Описание
        self.e_text.delete('1.0', 'end')
        self.e_text.insert('1.0', m.get('text', ''))

        # Статус
        self.e_status_var.set(m.get('status', 'planned'))

        # Дата выполнения
        self.e_done_date.delete(0, 'end')
        self.e_done_date.insert(0, m.get('doneDate', ''))

    def _on_edit_cat_changed(self, event=None):
        cat_str = self.e_cat_var.get()
        cat_id = cat_str.split(' \u2014 ')[0] if ' \u2014 ' in cat_str else cat_str
        self._update_subcat_combo(cat_id)

    def _update_subcat_combo(self, cat_id):
        subcats = get_subcats(cat_id)
        self.e_subcat_combo['values'] = subcats
        if subcats and not self.e_subcat_var.get():
            self.e_subcat_var.set(subcats[0])

    def _on_status_changed(self):
        if self.e_status_var.get() == 'done':
            if not self.e_done_date.get().strip():
                self.e_done_date.delete(0, 'end')
                self.e_done_date.insert(0, datetime.now().strftime('%d.%m.%Y'))
        elif self.e_status_var.get() != 'done':
            self.e_done_date.delete(0, 'end')

    # --- CRUD этапов --------------------------------------------------------
    def _add_stage(self):
        self._editing_id = None
        self.e_date.delete(0, 'end')
        self.e_date.insert(0, datetime.now().strftime('%d.%m.%Y'))
        self.e_cat_var.set('')
        self.e_subcat_var.set('')
        self.e_text.delete('1.0', 'end')
        self.e_status_var.set('planned')
        self.e_done_date.delete(0, 'end')
        # Фокус на категорию
        self.e_cat_combo.focus_set()

    def _save_stage(self):
        cat_str = self.e_cat_var.get()
        cat_id = cat_str.split(' \u2014 ')[0] if ' \u2014 ' in cat_str else cat_str
        if not cat_id:
            messagebox.showwarning('Ошибка', 'Выберите категорию')
            return

        text = self.e_text.get('1.0', 'end').strip()
        if not text:
            messagebox.showwarning('Ошибка', 'Укажите описание')
            return

        subcat = self.e_subcat_var.get().strip()
        # Автоматически добавляем подкатегорию если новая
        if subcat:
            c = next((x for x in categories if x['id'] == cat_id), None)
            if c and subcat not in c.get('subcategories', []):
                c.setdefault('subcategories', []).append(subcat)

        status = self.e_status_var.get()
        date_val = self.e_date.get().strip()
        done_date = self.e_done_date.get().strip()

        if self._editing_id is not None:
            m = next((x for x in milestones if x['id'] == self._editing_id), None)
            if not m:
                messagebox.showerror('Ошибка', 'Этап не найден')
                return
        else:
            m = {'id': next_id(), 'order': max((x.get('order', 0) for x in milestones), default=-1) + 1}
            milestones.append(m)
            self._editing_id = m['id']

        m['cat'] = cat_id
        m['subcat'] = subcat
        m['text'] = text
        m['status'] = status
        m['date'] = date_val
        m['doneDate'] = done_date

        self._refresh_stages()
        self._refresh_versions()
        # Выбрать сохранённый элемент
        try:
            self.stage_tree.selection_set(str(m['id']))
            self.stage_tree.see(str(m['id']))
        except Exception:
            pass
        self._status('Этап сохранён (в памяти). Нажмите «Сохранить все» для записи в файл.')

    def _edit_stage_dialog(self):
        """Двойной клик — просто выбирает и заполняет форму (уже делает _on_stage_select)."""
        pass

    def _delete_stage(self):
        sel = self.stage_tree.selection()
        if not sel:
            return
        sid = sel[0]
        m = next((x for x in milestones if str(x.get('id', '')) == sid), None)
        if not m:
            return
        if not messagebox.askyesno('Удаление', f'Удалить этап «{m.get("text", "")}»?'):
            return
        milestones.remove(m)
        self._editing_id = None
        self._refresh_stages()
        self._refresh_versions()
        self._status('Этап удалён')

    def _move_up(self):
        sel = self.stage_tree.selection()
        if not sel:
            return
        sid = sel[0]
        sorted_ms = sorted(milestones, key=lambda x: x.get('order', 0))
        idx = next((i for i, m in enumerate(sorted_ms) if str(m.get('id', '')) == sid), None)
        if idx is None or idx == 0:
            return
        # Меняем order
        sorted_ms[idx]['order'], sorted_ms[idx - 1]['order'] = \
            sorted_ms[idx - 1]['order'], sorted_ms[idx]['order']
        self._refresh_stages()
        self.stage_tree.selection_set(sid)
        self.stage_tree.see(sid)

    def _move_down(self):
        sel = self.stage_tree.selection()
        if not sel:
            return
        sid = sel[0]
        sorted_ms = sorted(milestones, key=lambda x: x.get('order', 0))
        idx = next((i for i, m in enumerate(sorted_ms) if str(m.get('id', '')) == sid), None)
        if idx is None or idx >= len(sorted_ms) - 1:
            return
        sorted_ms[idx]['order'], sorted_ms[idx + 1]['order'] = \
            sorted_ms[idx + 1]['order'], sorted_ms[idx]['order']
        self._refresh_stages()
        self.stage_tree.selection_set(sid)
        self.stage_tree.see(sid)

    # === Категории ==========================================================
    def _build_categories_tab(self):
        f = self.tab_categories

        left = ttk.Frame(f)
        left.pack(side='left', fill='both', expand=True, padx=(8, 4), pady=8)

        ttk.Label(left, text='Категории', font=('Segoe UI', 11, 'bold'),
                  foreground=ACCENT).pack(anchor='w')

        tree_frame = ttk.Frame(left)
        tree_frame.pack(fill='both', expand=True, pady=(6, 0))

        cols = ('id', 'icon', 'name', 'version', 'subcats')
        self.cat_tree = ttk.Treeview(tree_frame, columns=cols, show='headings', selectmode='browse')
        self.cat_tree.heading('id', text='ID')
        self.cat_tree.heading('icon', text='Иконка')
        self.cat_tree.heading('name', text='Название')
        self.cat_tree.heading('version', text='Версия')
        self.cat_tree.heading('subcats', text='Подкатегории')
        self.cat_tree.column('id', width=80, minwidth=50)
        self.cat_tree.column('icon', width=60, minwidth=40)
        self.cat_tree.column('name', width=140, minwidth=80)
        self.cat_tree.column('version', width=70, minwidth=50, anchor='center')
        self.cat_tree.column('subcats', width=250, minwidth=100)
        self.cat_tree.pack(side='left', fill='both', expand=True)

        self.cat_tree.bind('<<TreeviewSelect>>', self._on_category_select)

        btn_row = tk.Frame(left, bg=BG)
        btn_row.pack(fill='x', pady=(6, 0))
        ttk.Button(btn_row, text='+ Новая категория', command=self._new_category).pack(side='left')
        ttk.Button(btn_row, text='Удалить', style='Danger.TButton',
                   command=self._delete_category).pack(side='left', padx=8)

        # Правая часть: редактирование
        right = ttk.Frame(f)
        right.pack(side='right', fill='both', expand=True, padx=(4, 8), pady=8)

        ef = tk.LabelFrame(right, text=' Редактирование категории ', bg=BG, fg=ACCENT,
                           font=('Segoe UI', 10, 'bold'), bd=1, relief='solid',
                           highlightbackground=BORDER)
        ef.pack(fill='x')

        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=(10, 4))
        tk.Label(r, text='ID:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.c_id = tk.Entry(r, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                             relief='solid', width=12, font=('Segoe UI', 9))
        self.c_id.pack(side='left', padx=6)
        tk.Label(r, text='Иконка:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left', padx=(12, 0))
        self.c_icon = tk.Entry(r, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                               relief='solid', width=10, font=('Segoe UI', 9))
        self.c_icon.pack(side='left', padx=6)

        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=4)
        tk.Label(r, text='Название:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.c_name = tk.Entry(r, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                               relief='solid', font=('Segoe UI', 9))
        self.c_name.pack(side='left', fill='x', expand=True, padx=6)

        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=4)
        self.c_visible_var = tk.BooleanVar(value=True)
        tk.Checkbutton(r, text='Видима на сайте', variable=self.c_visible_var,
                       bg=BG, fg=FG, selectcolor=BG2, activebackground=BG,
                       activeforeground=FG, font=('Segoe UI', 9)).pack(side='left')
        tk.Label(r, text='Порядок:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left', padx=(16, 0))
        self.c_order = tk.Entry(r, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                relief='solid', width=5, font=('Segoe UI', 9))
        self.c_order.pack(side='left', padx=6)
        self.c_order.insert(0, '0')

        # Подкатегории
        sf = tk.LabelFrame(ef, text=' Подкатегории ', bg=BG, fg=FG2,
                           font=('Segoe UI', 9), bd=1, relief='solid',
                           highlightbackground=BORDER)
        sf.pack(fill='both', expand=True, padx=10, pady=(8, 4))

        self.subcat_listbox = tk.Listbox(sf, bg=BG2, fg=FG, selectbackground='#1f6feb',
                                          selectforeground='#fff', font=('Segoe UI', 9),
                                          bd=0, highlightthickness=0, height=6)
        self.subcat_listbox.pack(fill='both', expand=True, padx=6, pady=(4, 2))

        sc_btns = tk.Frame(sf, bg=BG)
        sc_btns.pack(fill='x', padx=6, pady=(0, 6))
        self.sc_entry = tk.Entry(sc_btns, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                  relief='solid', font=('Segoe UI', 9), width=20)
        self.sc_entry.pack(side='left')
        ttk.Button(sc_btns, text='+', command=self._add_subcat, width=3).pack(side='left', padx=4)
        ttk.Button(sc_btns, text='\u2212', command=self._remove_subcat, width=3).pack(side='left')

        r = tk.Frame(ef, bg=BG); r.pack(fill='x', padx=10, pady=(4, 10))
        ttk.Button(r, text='Сохранить категорию', style='Accent.TButton',
                   command=self._save_category).pack(side='left')

    def _refresh_categories(self):
        self.cat_tree.delete(*self.cat_tree.get_children())
        for c in sorted(categories, key=lambda x: x.get('order', 0)):
            v = cat_version(c['id'])
            subcats = ', '.join(c.get('subcategories', []))
            self.cat_tree.insert('', 'end', iid=c['id'],
                                 values=(c['id'], c.get('icon', ''), c['name'],
                                         f'v0.{v:02d}', subcats))

    def _on_category_select(self, event=None):
        sel = self.cat_tree.selection()
        if not sel:
            return
        cid = sel[0]
        c = next((x for x in categories if x['id'] == cid), None)
        if not c:
            return
        self.c_id.delete(0, 'end'); self.c_id.insert(0, c['id'])
        self.c_icon.delete(0, 'end'); self.c_icon.insert(0, c.get('icon', ''))
        self.c_name.delete(0, 'end'); self.c_name.insert(0, c['name'])
        self.c_visible_var.set(c.get('visible', True))
        self.c_order.delete(0, 'end'); self.c_order.insert(0, str(c.get('order', 0)))

        self.subcat_listbox.delete(0, 'end')
        for sc in c.get('subcategories', []):
            self.subcat_listbox.insert('end', sc)

    def _add_subcat(self):
        name = self.sc_entry.get().strip()
        if not name:
            return
        self.subcat_listbox.insert('end', name)
        self.sc_entry.delete(0, 'end')

    def _remove_subcat(self):
        sel = self.subcat_listbox.curselection()
        if sel:
            self.subcat_listbox.delete(sel[0])

    def _save_category(self):
        cid = self.c_id.get().strip()
        if not cid:
            messagebox.showwarning('Ошибка', 'Укажите ID')
            return
        c = next((x for x in categories if x['id'] == cid), None)
        if c is None:
            c = {'id': cid}
            categories.append(c)
        c['icon'] = self.c_icon.get().strip()
        c['name'] = self.c_name.get().strip()
        c['visible'] = self.c_visible_var.get()
        try:
            c['order'] = int(self.c_order.get())
        except ValueError:
            c['order'] = 0
        # Подкатегории из листбокса
        c['subcategories'] = list(self.subcat_listbox.get(0, 'end'))

        self._refresh_all()
        self._status('Категория сохранена (в памяти)')

    def _new_category(self):
        self.c_id.delete(0, 'end')
        self.c_icon.delete(0, 'end')
        self.c_name.delete(0, 'end')
        self.c_visible_var.set(True)
        mx = max((c.get('order', 0) for c in categories), default=-1) + 1
        self.c_order.delete(0, 'end'); self.c_order.insert(0, str(mx))
        self.subcat_listbox.delete(0, 'end')

    def _delete_category(self):
        sel = self.cat_tree.selection()
        if not sel:
            return
        cid = sel[0]
        c = next((x for x in categories if x['id'] == cid), None)
        if not c:
            return
        count = sum(1 for m in milestones if m.get('cat') == cid)
        msg = f'Удалить категорию «{c["name"]}»?'
        if count:
            msg += f'\n\nВ ней {count} этапов, они останутся без категории.'
        if not messagebox.askyesno('Удаление', msg):
            return
        categories.remove(c)
        self._refresh_all()
        self._status(f'Категория «{c["name"]}» удалена')

    # === Общие действия =====================================================
    def _save_all(self):
        save_all()
        self._status('\u2705 Все данные сохранены в JSON')

    def _reload(self):
        reload_data()
        self._refresh_all()
        self._status('\U0001f504 Данные перезагружены из файлов')

    def _publish(self):
        save_all()
        try:
            pub_root = os.path.normpath(os.path.join(PUBLISH_DIR, '..'))
            if os.path.exists(os.path.join(pub_root, '.git')):
                self._status('Синхронизация _publish с GitHub...')
                self.update_idletasks()
                subprocess.run([GIT, 'fetch', 'origin'], cwd=pub_root,
                               capture_output=True, timeout=30)
                subprocess.run([GIT, 'reset', '--hard', 'origin/main'], cwd=pub_root,
                               capture_output=True, timeout=15)
                subprocess.run([GIT, 'clean', '-fd'], cwd=pub_root,
                               capture_output=True, timeout=15)

            pub_data = os.path.join(PUBLISH_DIR, 'data')
            os.makedirs(pub_data, exist_ok=True)

            src_html = os.path.join(BASE_DIR, 'index.html')
            if os.path.exists(src_html):
                shutil.copy2(src_html, os.path.join(PUBLISH_DIR, 'index.html'))

            for fname in ['milestones.json', 'categories.json']:
                src = os.path.join(DATA_DIR, fname)
                if os.path.exists(src):
                    shutil.copy2(src, os.path.join(pub_data, fname))

            self._status('Файлы скопированы, запускаю publish.bat...')
            self.update_idletasks()

            if os.path.exists(PUBLISH_BAT):
                subprocess.Popen(['cmd', '/c', 'start', 'cmd', '/k', PUBLISH_BAT],
                                 cwd=os.path.dirname(PUBLISH_BAT), shell=False)
                self._status('publish.bat запущен')
                messagebox.showinfo('Публикация',
                    'publish.bat запущен в отдельном окне.\nСледите за ходом в консоли.')
            else:
                self._status('Файлы скопированы. publish.bat не найден.')
                messagebox.showinfo('Публикация',
                    f'Файлы скопированы в:\n{PUBLISH_DIR}\n\npublish.bat не найден.')
        except Exception as e:
            self._status(f'Ошибка: {e}')
            messagebox.showerror('Ошибка', str(e))

    def _status(self, text):
        self._status_var.set(text)


# --- Entry point ------------------------------------------------------------
if __name__ == '__main__':
    app = EditorApp()
    app.mainloop()
