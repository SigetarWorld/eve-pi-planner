#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Валера — Редактор дорожной карты и возможностей
Десктопное приложение для управления данными сайта sigetar.ru/valheim
"""

import json
import os
import shutil
import subprocess
import sys
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime

# ─── Пути ───────────────────────────────────────────────────────────────
def get_base_dir():
    """Определяет базовую директорию (рядом с exe или рядом со скриптом)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_dir()
DATA_DIR = os.path.join(BASE_DIR, 'data')
PUBLISH_DIR = os.path.join(BASE_DIR, '..', '_publish', 'valheim')
PUBLISH_BAT = os.path.join(BASE_DIR, '..', 'publish.bat')

# ─── Утилиты JSON ───────────────────────────────────────────────────────
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

# ─── Данные ──────────────────────────────────────────────────────────────
milestones = []
features = []
categories = []

def reload_data():
    global milestones, features, categories
    milestones = load_json('milestones.json')
    features = load_json('features.json')
    categories = load_json('categories.json')

def save_all():
    save_json('milestones.json', milestones)
    save_json('features.json', features)
    save_json('categories.json', categories)

# ─── Цвета темы ─────────────────────────────────────────────────────────
BG = '#0d1117'
BG2 = '#161b22'
BG3 = '#21262d'
FG = '#e6edf3'
FG2 = '#8b949e'
ACCENT = '#58a6ff'
GREEN = '#4ade80'
RED = '#f85149'
BORDER = '#30363d'

# ─── Главное окно ────────────────────────────────────────────────────────
class EditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Валера — Редактор дорожной карты')
        self.geometry('1100x720')
        self.configure(bg=BG)
        self.minsize(800, 500)

        reload_data()

        style = ttk.Style()
        style.theme_use('clam')
        style.configure('.', background=BG, foreground=FG, fieldbackground=BG2,
                        bordercolor=BORDER, darkcolor=BG, lightcolor=BG)
        style.configure('TNotebook', background=BG, borderwidth=0)
        style.configure('TNotebook.Tab', background=BG2, foreground=FG,
                        padding=[12, 6], font=('Segoe UI', 10))
        style.map('TNotebook.Tab',
                  background=[('selected', BG3)],
                  foreground=[('selected', ACCENT)])
        style.configure('TFrame', background=BG)
        style.configure('TLabel', background=BG, foreground=FG, font=('Segoe UI', 9))
        style.configure('TButton', background=BG2, foreground=FG,
                        font=('Segoe UI', 9, 'bold'), borderwidth=1, relief='solid')
        style.map('TButton', background=[('active', BG3)])
        style.configure('Accent.TButton', background='#1f6feb', foreground='#fff')
        style.map('Accent.TButton', background=[('active', '#388bfd')])
        style.configure('Danger.TButton', background='#da3633', foreground='#fff')
        style.map('Danger.TButton', background=[('active', '#f85149')])
        style.configure('Green.TButton', background='#238636', foreground='#fff')
        style.map('Green.TButton', background=[('active', '#2ea043')])
        style.configure('Treeview', background=BG2, foreground=FG,
                        fieldbackground=BG2, font=('Segoe UI', 9),
                        rowheight=26, borderwidth=0)
        style.configure('Treeview.Heading', background=BG3, foreground=ACCENT,
                        font=('Segoe UI', 9, 'bold'))
        style.map('Treeview', background=[('selected', '#1f6feb')],
                  foreground=[('selected', '#fff')])
        style.configure('TEntry', fieldbackground=BG2, foreground=FG,
                        insertcolor=FG, borderwidth=1, relief='solid')
        style.configure('TCheckbutton', background=BG, foreground=FG)

        # Notebook (tabs)
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill='both', expand=True, padx=8, pady=(8, 0))

        self.tab_milestones = ttk.Frame(self.notebook)
        self.tab_categories = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_milestones, text='  Дорожная карта  ')
        self.notebook.add(self.tab_categories, text='  Категории  ')

        self._build_milestones_tab()
        self._build_categories_tab()

        # Bottom bar
        bottom = tk.Frame(self, bg=BG, height=48)
        bottom.pack(fill='x', padx=8, pady=8)

        ttk.Button(bottom, text='💾 Сохранить всё', style='Accent.TButton',
                   command=self._save_all).pack(side='left', padx=(0, 8))
        ttk.Button(bottom, text='🔄 Перезагрузить', command=self._reload).pack(side='left', padx=(0, 8))
        ttk.Button(bottom, text='🚀 Опубликовать на сайт', style='Green.TButton',
                   command=self._publish).pack(side='right')

        self._status_var = tk.StringVar(value='Готово')
        tk.Label(bottom, textvariable=self._status_var, bg=BG, fg=FG2,
                 font=('Segoe UI', 9)).pack(side='right', padx=16)

        self._refresh_milestones()
        self._refresh_categories()

    # ─── Milestones Tab ──────────────────────────────────────────────────
    def _build_milestones_tab(self):
        f = self.tab_milestones

        # Left: milestones list
        left = ttk.Frame(f)
        left.pack(side='left', fill='both', expand=True, padx=(8, 4), pady=8)

        ttk.Label(left, text='Этапы дорожной карты', font=('Segoe UI', 11, 'bold'),
                  foreground=ACCENT).pack(anchor='w')

        tree_frame = ttk.Frame(left)
        tree_frame.pack(fill='both', expand=True, pady=(6, 0))

        cols = ('ver', 'title', 'status', 'date')
        self.ms_tree = ttk.Treeview(tree_frame, columns=cols, show='headings', selectmode='browse')
        self.ms_tree.heading('ver', text='Версия')
        self.ms_tree.heading('title', text='Название')
        self.ms_tree.heading('status', text='Статус')
        self.ms_tree.heading('date', text='Дата')
        self.ms_tree.column('ver', width=70, minwidth=50)
        self.ms_tree.column('title', width=200, minwidth=100)
        self.ms_tree.column('status', width=80, minwidth=60)
        self.ms_tree.column('date', width=90, minwidth=70)

        sb = ttk.Scrollbar(tree_frame, orient='vertical', command=self.ms_tree.yview)
        self.ms_tree.configure(yscrollcommand=sb.set)
        self.ms_tree.pack(side='left', fill='both', expand=True)
        sb.pack(side='right', fill='y')

        self.ms_tree.bind('<<TreeviewSelect>>', self._on_milestone_select)

        btn_row = tk.Frame(left, bg=BG)
        btn_row.pack(fill='x', pady=(6, 0))
        ttk.Button(btn_row, text='+ Новый этап', command=self._new_milestone).pack(side='left')
        ttk.Button(btn_row, text='Удалить', style='Danger.TButton',
                   command=self._delete_milestone).pack(side='left', padx=8)

        # Right: edit form + features
        right = ttk.Frame(f)
        right.pack(side='right', fill='both', expand=True, padx=(4, 8), pady=8)

        # Milestone edit fields
        ef = tk.LabelFrame(right, text=' Редактирование этапа ', bg=BG, fg=ACCENT,
                           font=('Segoe UI', 10, 'bold'), bd=1, relief='solid',
                           highlightbackground=BORDER)
        ef.pack(fill='x')

        row1 = tk.Frame(ef, bg=BG)
        row1.pack(fill='x', padx=8, pady=(8, 4))
        tk.Label(row1, text='Версия:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.ms_ver = tk.Entry(row1, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                               relief='solid', width=10, font=('Segoe UI', 9))
        self.ms_ver.pack(side='left', padx=(4, 16))
        tk.Label(row1, text='Дата:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.ms_date = tk.Entry(row1, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                 relief='solid', width=12, font=('Segoe UI', 9))
        self.ms_date.pack(side='left', padx=4)

        row2 = tk.Frame(ef, bg=BG)
        row2.pack(fill='x', padx=8, pady=4)
        tk.Label(row2, text='Название:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.ms_title = tk.Entry(row2, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                  relief='solid', font=('Segoe UI', 9))
        self.ms_title.pack(side='left', fill='x', expand=True, padx=4)

        row3 = tk.Frame(ef, bg=BG)
        row3.pack(fill='x', padx=8, pady=4)
        self.ms_done_var = tk.BooleanVar()
        tk.Checkbutton(row3, text='Выполнено', variable=self.ms_done_var,
                       bg=BG, fg=GREEN, selectcolor=BG2, activebackground=BG,
                       activeforeground=GREEN, font=('Segoe UI', 9)).pack(side='left')
        self.ms_wip_var = tk.BooleanVar()
        tk.Checkbutton(row3, text='В работе', variable=self.ms_wip_var,
                       bg=BG, fg='#f0ad4e', selectcolor=BG2, activebackground=BG,
                       activeforeground='#f0ad4e', font=('Segoe UI', 9)).pack(side='left', padx=16)

        row4 = tk.Frame(ef, bg=BG)
        row4.pack(fill='x', padx=8, pady=4)
        tk.Label(row4, text='Вес:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.ms_weight = tk.Entry(row4, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                   relief='solid', width=5, font=('Segoe UI', 9))
        self.ms_weight.pack(side='left', padx=(4, 16))
        self.ms_weight.insert(0, '1')
        tk.Label(row4, text='Порядок:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.ms_order = tk.Entry(row4, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                  relief='solid', width=5, font=('Segoe UI', 9))
        self.ms_order.pack(side='left', padx=4)
        self.ms_order.insert(0, '0')

        btn_save = tk.Frame(ef, bg=BG)
        btn_save.pack(fill='x', padx=8, pady=(4, 8))
        ttk.Button(btn_save, text='Сохранить этап', style='Accent.TButton',
                   command=self._save_milestone).pack(side='left')

        # Features for selected milestone
        ff = tk.LabelFrame(right, text=' Строки этапа (возможности) ', bg=BG, fg=ACCENT,
                           font=('Segoe UI', 10, 'bold'), bd=1, relief='solid',
                           highlightbackground=BORDER)
        ff.pack(fill='both', expand=True, pady=(8, 0))

        feat_tree_frame = ttk.Frame(ff)
        feat_tree_frame.pack(fill='both', expand=True, padx=8, pady=(4, 4))

        fcols = ('done', 'cat', 'text', 'date', 'doneDate')
        self.feat_tree = ttk.Treeview(feat_tree_frame, columns=fcols, show='headings',
                                       selectmode='browse', height=8)
        self.feat_tree.heading('done', text='✓')
        self.feat_tree.heading('cat', text='Категория')
        self.feat_tree.heading('text', text='Описание')
        self.feat_tree.heading('date', text='Создано')
        self.feat_tree.heading('doneDate', text='Выполнено')
        self.feat_tree.column('done', width=30, minwidth=30, anchor='center')
        self.feat_tree.column('cat', width=100, minwidth=60)
        self.feat_tree.column('text', width=250, minwidth=100)
        self.feat_tree.column('date', width=85, minwidth=60)
        self.feat_tree.column('doneDate', width=85, minwidth=60)

        fsb = ttk.Scrollbar(feat_tree_frame, orient='vertical', command=self.feat_tree.yview)
        self.feat_tree.configure(yscrollcommand=fsb.set)
        self.feat_tree.pack(side='left', fill='both', expand=True)
        fsb.pack(side='right', fill='y')

        self.feat_tree.bind('<Double-1>', self._edit_feature)

        feat_btns = tk.Frame(ff, bg=BG)
        feat_btns.pack(fill='x', padx=8, pady=(0, 8))
        ttk.Button(feat_btns, text='+ Добавить строку', command=self._add_feature).pack(side='left')
        ttk.Button(feat_btns, text='✎ Редактировать', command=lambda: self._edit_feature(None)).pack(side='left', padx=8)
        ttk.Button(feat_btns, text='Удалить строку', style='Danger.TButton',
                   command=self._delete_feature).pack(side='left')
        ttk.Button(feat_btns, text='✓/✗ Переключить', command=self._toggle_feature_done).pack(side='right')

    # ─── Categories Tab ──────────────────────────────────────────────────
    def _build_categories_tab(self):
        f = self.tab_categories

        left = ttk.Frame(f)
        left.pack(side='left', fill='both', expand=True, padx=(8, 4), pady=8)

        ttk.Label(left, text='Категории возможностей', font=('Segoe UI', 11, 'bold'),
                  foreground=ACCENT).pack(anchor='w')

        tree_frame = ttk.Frame(left)
        tree_frame.pack(fill='both', expand=True, pady=(6, 0))

        cols = ('id', 'icon', 'name', 'visible')
        self.cat_tree = ttk.Treeview(tree_frame, columns=cols, show='headings', selectmode='browse')
        self.cat_tree.heading('id', text='ID')
        self.cat_tree.heading('icon', text='Иконка')
        self.cat_tree.heading('name', text='Название')
        self.cat_tree.heading('visible', text='Видима')
        self.cat_tree.column('id', width=90, minwidth=60)
        self.cat_tree.column('icon', width=70, minwidth=50)
        self.cat_tree.column('name', width=180, minwidth=80)
        self.cat_tree.column('visible', width=60, minwidth=50, anchor='center')
        self.cat_tree.pack(side='left', fill='both', expand=True)

        self.cat_tree.bind('<<TreeviewSelect>>', self._on_category_select)

        btn_row = tk.Frame(left, bg=BG)
        btn_row.pack(fill='x', pady=(6, 0))
        ttk.Button(btn_row, text='+ Новая категория', command=self._new_category).pack(side='left')
        ttk.Button(btn_row, text='Удалить', style='Danger.TButton',
                   command=self._delete_category).pack(side='left', padx=8)

        # Edit form
        right = ttk.Frame(f)
        right.pack(side='right', fill='both', expand=True, padx=(4, 8), pady=8)

        ef = tk.LabelFrame(right, text=' Редактирование категории ', bg=BG, fg=ACCENT,
                           font=('Segoe UI', 10, 'bold'), bd=1, relief='solid',
                           highlightbackground=BORDER)
        ef.pack(fill='x')

        row1 = tk.Frame(ef, bg=BG)
        row1.pack(fill='x', padx=8, pady=(8, 4))
        tk.Label(row1, text='ID:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.cat_id = tk.Entry(row1, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                relief='solid', width=15, font=('Segoe UI', 9))
        self.cat_id.pack(side='left', padx=(4, 16))
        tk.Label(row1, text='Иконка:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.cat_icon = tk.Entry(row1, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                  relief='solid', width=10, font=('Segoe UI', 9))
        self.cat_icon.pack(side='left', padx=4)

        row2 = tk.Frame(ef, bg=BG)
        row2.pack(fill='x', padx=8, pady=4)
        tk.Label(row2, text='Название:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.cat_name = tk.Entry(row2, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                  relief='solid', font=('Segoe UI', 9))
        self.cat_name.pack(side='left', fill='x', expand=True, padx=4)

        row3 = tk.Frame(ef, bg=BG)
        row3.pack(fill='x', padx=8, pady=4)
        self.cat_visible_var = tk.BooleanVar(value=True)
        tk.Checkbutton(row3, text='Видима на сайте', variable=self.cat_visible_var,
                       bg=BG, fg=FG, selectcolor=BG2, activebackground=BG,
                       activeforeground=FG, font=('Segoe UI', 9)).pack(side='left')
        tk.Label(row3, text='Порядок:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left', padx=(16, 0))
        self.cat_order = tk.Entry(row3, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                   relief='solid', width=5, font=('Segoe UI', 9))
        self.cat_order.pack(side='left', padx=4)
        self.cat_order.insert(0, '0')

        btn_row2 = tk.Frame(ef, bg=BG)
        btn_row2.pack(fill='x', padx=8, pady=(4, 8))
        ttk.Button(btn_row2, text='Сохранить категорию', style='Accent.TButton',
                   command=self._save_category).pack(side='left')

    # ─── Milestones logic ────────────────────────────────────────────────
    def _refresh_milestones(self):
        self.ms_tree.delete(*self.ms_tree.get_children())
        sorted_ms = sorted(milestones, key=lambda m: m.get('order', 0))
        for m in sorted_ms:
            status = '✅' if m.get('done') else ('🔧' if m.get('wip') else '⬜')
            self.ms_tree.insert('', 'end', iid=m['ver'],
                                values=(m['ver'], m['title'], status, m.get('date', '')))

    def _on_milestone_select(self, event=None):
        sel = self.ms_tree.selection()
        if not sel:
            return
        ver = sel[0]
        m = next((x for x in milestones if x['ver'] == ver), None)
        if not m:
            return

        self.ms_ver.delete(0, 'end')
        self.ms_ver.insert(0, m['ver'])
        self.ms_title.delete(0, 'end')
        self.ms_title.insert(0, m['title'])
        self.ms_date.delete(0, 'end')
        self.ms_date.insert(0, m.get('date', ''))
        self.ms_done_var.set(m.get('done', False))
        self.ms_wip_var.set(m.get('wip', False))
        self.ms_weight.delete(0, 'end')
        self.ms_weight.insert(0, str(m.get('w', 1)))
        self.ms_order.delete(0, 'end')
        self.ms_order.insert(0, str(m.get('order', 0)))

        self._refresh_features(ver)

    def _save_milestone(self):
        ver = self.ms_ver.get().strip()
        if not ver:
            messagebox.showwarning('Ошибка', 'Укажите версию')
            return

        m = next((x for x in milestones if x['ver'] == ver), None)
        if m is None:
            m = {'ver': ver}
            milestones.append(m)

        m['title'] = self.ms_title.get().strip()
        m['done'] = self.ms_done_var.get()
        m['wip'] = self.ms_wip_var.get()
        m['date'] = self.ms_date.get().strip()
        try:
            m['w'] = int(self.ms_weight.get())
        except ValueError:
            m['w'] = 1
        try:
            m['order'] = int(self.ms_order.get())
        except ValueError:
            m['order'] = 0

        self._refresh_milestones()
        self.ms_tree.selection_set(ver)
        self._status('Этап сохранён (в памяти). Нажмите «Сохранить всё» для записи в файл.')

    def _new_milestone(self):
        self.ms_ver.delete(0, 'end')
        self.ms_title.delete(0, 'end')
        self.ms_date.delete(0, 'end')
        self.ms_done_var.set(False)
        self.ms_wip_var.set(False)
        self.ms_weight.delete(0, 'end')
        self.ms_weight.insert(0, '1')
        max_order = max((m.get('order', 0) for m in milestones), default=-1) + 1
        self.ms_order.delete(0, 'end')
        self.ms_order.insert(0, str(max_order))
        # Suggest next version
        vers = [m['ver'] for m in milestones if m['ver'].startswith('v0.')]
        if vers:
            nums = []
            for v in vers:
                try:
                    nums.append(int(v.replace('v0.', '')))
                except ValueError:
                    pass
            if nums:
                self.ms_ver.insert(0, f'v0.{max(nums)+1:02d}')
        self.feat_tree.delete(*self.feat_tree.get_children())

    def _delete_milestone(self):
        sel = self.ms_tree.selection()
        if not sel:
            return
        ver = sel[0]
        m = next((x for x in milestones if x['ver'] == ver), None)
        if not m:
            return
        if not messagebox.askyesno('Удаление', f'Удалить этап {ver} «{m["title"]}»?'):
            return
        milestones.remove(m)
        # Also remove features of this milestone
        global features
        features = [f for f in features if f.get('ver') != ver]
        self._refresh_milestones()
        self._status(f'Этап {ver} удалён')

    # ─── Features logic ──────────────────────────────────────────────────
    def _refresh_features(self, ver=None):
        self.feat_tree.delete(*self.feat_tree.get_children())
        if ver is None:
            sel = self.ms_tree.selection()
            if not sel:
                return
            ver = sel[0]

        ms_feats = [f for f in features if f.get('ver') == ver]
        for i, f in enumerate(ms_feats):
            done_mark = '✅' if f.get('done', True) else '⬜'
            cat_name = f.get('cat', '')
            # Look up category name
            cat_obj = next((c for c in categories if c['id'] == cat_name), None)
            if cat_obj:
                cat_name = cat_obj['name']
            self.feat_tree.insert('', 'end', iid=str(f.get('id', i)),
                                  values=(done_mark, cat_name, f.get('text', ''),
                                          f.get('date', ''), f.get('doneDate', '')))

    def _get_selected_ms_ver(self):
        sel = self.ms_tree.selection()
        if not sel:
            messagebox.showwarning('Ошибка', 'Выберите этап')
            return None
        return sel[0]

    def _add_feature(self):
        ver = self._get_selected_ms_ver()
        if not ver:
            return
        FeatureDialog(self, ver=ver, feature=None, callback=self._on_feature_saved)

    def _edit_feature(self, event):
        ver = self._get_selected_ms_ver()
        if not ver:
            return
        sel = self.feat_tree.selection()
        if not sel:
            messagebox.showinfo('Инфо', 'Выберите строку для редактирования')
            return
        fid = sel[0]
        feat = next((f for f in features if str(f.get('id', '')) == fid), None)
        if feat:
            FeatureDialog(self, ver=ver, feature=feat, callback=self._on_feature_saved)

    def _on_feature_saved(self):
        ver = self._get_selected_ms_ver()
        self._refresh_features(ver)
        self._auto_compute_milestone(ver)

    def _delete_feature(self):
        sel = self.feat_tree.selection()
        if not sel:
            return
        fid = sel[0]
        feat = next((f for f in features if str(f.get('id', '')) == fid), None)
        if not feat:
            return
        if not messagebox.askyesno('Удаление', f'Удалить строку «{feat.get("text", "")}»?'):
            return
        features.remove(feat)
        ver = self._get_selected_ms_ver()
        self._refresh_features(ver)
        self._auto_compute_milestone(ver)
        self._status('Строка удалена')

    def _toggle_feature_done(self):
        sel = self.feat_tree.selection()
        if not sel:
            return
        fid = sel[0]
        feat = next((f for f in features if str(f.get('id', '')) == fid), None)
        if not feat:
            return
        was_done = feat.get('done', True)
        feat['done'] = not was_done
        if feat['done'] and not feat.get('doneDate'):
            feat['doneDate'] = datetime.now().strftime('%d.%m.%Y')
        elif not feat['done']:
            feat['doneDate'] = ''

        ver = self._get_selected_ms_ver()
        self._refresh_features(ver)
        self._auto_compute_milestone(ver)

    def _auto_compute_milestone(self, ver):
        if not ver:
            return
        m = next((x for x in milestones if x['ver'] == ver), None)
        if not m:
            return
        ms_feats = [f for f in features if f.get('ver') == ver]
        if not ms_feats:
            return
        all_done = all(f.get('done', True) for f in ms_feats)
        any_done = any(f.get('done', True) for f in ms_feats)
        m['done'] = all_done
        m['wip'] = not all_done and any_done
        if all_done and not m.get('date'):
            m['date'] = datetime.now().strftime('%d.%m.%Y')
        self._refresh_milestones()

    # ─── Categories logic ────────────────────────────────────────────────
    def _refresh_categories(self):
        self.cat_tree.delete(*self.cat_tree.get_children())
        sorted_cats = sorted(categories, key=lambda c: c.get('order', 0))
        for c in sorted_cats:
            vis = '✅' if c.get('visible', True) else '❌'
            self.cat_tree.insert('', 'end', iid=c['id'],
                                 values=(c['id'], c.get('icon', ''), c['name'], vis))

    def _on_category_select(self, event=None):
        sel = self.cat_tree.selection()
        if not sel:
            return
        cid = sel[0]
        c = next((x for x in categories if x['id'] == cid), None)
        if not c:
            return
        self.cat_id.delete(0, 'end')
        self.cat_id.insert(0, c['id'])
        self.cat_icon.delete(0, 'end')
        self.cat_icon.insert(0, c.get('icon', ''))
        self.cat_name.delete(0, 'end')
        self.cat_name.insert(0, c['name'])
        self.cat_visible_var.set(c.get('visible', True))
        self.cat_order.delete(0, 'end')
        self.cat_order.insert(0, str(c.get('order', 0)))

    def _save_category(self):
        cid = self.cat_id.get().strip()
        if not cid:
            messagebox.showwarning('Ошибка', 'Укажите ID')
            return
        c = next((x for x in categories if x['id'] == cid), None)
        if c is None:
            c = {'id': cid}
            categories.append(c)
        c['icon'] = self.cat_icon.get().strip()
        c['name'] = self.cat_name.get().strip()
        c['visible'] = self.cat_visible_var.get()
        try:
            c['order'] = int(self.cat_order.get())
        except ValueError:
            c['order'] = 0
        self._refresh_categories()
        self._status('Категория сохранена (в памяти)')

    def _new_category(self):
        self.cat_id.delete(0, 'end')
        self.cat_icon.delete(0, 'end')
        self.cat_name.delete(0, 'end')
        self.cat_visible_var.set(True)
        max_order = max((c.get('order', 0) for c in categories), default=-1) + 1
        self.cat_order.delete(0, 'end')
        self.cat_order.insert(0, str(max_order))

    def _delete_category(self):
        sel = self.cat_tree.selection()
        if not sel:
            return
        cid = sel[0]
        c = next((x for x in categories if x['id'] == cid), None)
        if not c:
            return
        if not messagebox.askyesno('Удаление', f'Удалить категорию «{c["name"]}»?'):
            return
        categories.remove(c)
        self._refresh_categories()
        self._status(f'Категория «{c["name"]}» удалена')

    # ─── Global actions ──────────────────────────────────────────────────
    def _save_all(self):
        save_all()
        self._status('✅ Все данные сохранены в JSON')

    def _reload(self):
        reload_data()
        self._refresh_milestones()
        self._refresh_categories()
        self._status('🔄 Данные перезагружены из файлов')

    def _publish(self):
        # Save first
        save_all()

        GIT = r'C:\Program Files\Git\cmd\git.exe'

        try:
            # Reset _publish git repo to match remote (fixes conflicts)
            publish_git = os.path.join(PUBLISH_DIR, '..', '.git')
            if os.path.exists(publish_git) or os.path.exists(os.path.join(PUBLISH_DIR, '..', '.git')):
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

            # Copy files to _publish/valheim/
            pub_data = os.path.join(PUBLISH_DIR, 'data')
            os.makedirs(pub_data, exist_ok=True)

            src_html = os.path.join(BASE_DIR, 'index.html')
            if os.path.exists(src_html):
                shutil.copy2(src_html, os.path.join(PUBLISH_DIR, 'index.html'))

            for fname in ['milestones.json', 'features.json', 'categories.json']:
                src = os.path.join(DATA_DIR, fname)
                if os.path.exists(src):
                    shutil.copy2(src, os.path.join(pub_data, fname))

            self._status('Файлы скопированы, запускаю publish.bat...')
            self.update_idletasks()

            # Run publish.bat in a separate console window
            if os.path.exists(PUBLISH_BAT):
                subprocess.Popen(
                    ['cmd', '/c', 'start', 'cmd', '/k', PUBLISH_BAT],
                    cwd=os.path.dirname(PUBLISH_BAT),
                    shell=False
                )
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


# ─── Feature edit dialog ─────────────────────────────────────────────────
class FeatureDialog(tk.Toplevel):
    def __init__(self, parent, ver, feature=None, callback=None):
        super().__init__(parent)
        self.title('Редактирование строки' if feature else 'Новая строка')
        self.configure(bg=BG)
        self.geometry('500x320')
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        self.ver = ver
        self.feature = feature
        self.callback = callback

        pad = {'padx': 12, 'pady': 4}

        tk.Label(self, text='Категория:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(anchor='w', **pad)
        self.cat_var = tk.StringVar()
        cat_values = [f"{c['id']} — {c['name']}" for c in categories]
        self.cat_combo = ttk.Combobox(self, textvariable=self.cat_var, values=cat_values,
                                       state='readonly', font=('Segoe UI', 9))
        self.cat_combo.pack(fill='x', **pad)

        tk.Label(self, text='Описание:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(anchor='w', **pad)
        self.text_entry = tk.Entry(self, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                    relief='solid', font=('Segoe UI', 9))
        self.text_entry.pack(fill='x', **pad)

        row = tk.Frame(self, bg=BG)
        row.pack(fill='x', **pad)
        tk.Label(row, text='Дата создания:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.date_entry = tk.Entry(row, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                    relief='solid', width=12, font=('Segoe UI', 9))
        self.date_entry.pack(side='left', padx=(4, 16))
        tk.Label(row, text='Дата выполнения:', bg=BG, fg=FG, font=('Segoe UI', 9)).pack(side='left')
        self.done_date_entry = tk.Entry(row, bg=BG2, fg=FG, insertbackground=FG, bd=1,
                                         relief='solid', width=12, font=('Segoe UI', 9))
        self.done_date_entry.pack(side='left', padx=4)

        row2 = tk.Frame(self, bg=BG)
        row2.pack(fill='x', **pad)
        self.done_var = tk.BooleanVar(value=True)
        tk.Checkbutton(row2, text='Выполнено', variable=self.done_var,
                       bg=BG, fg=GREEN, selectcolor=BG2, activebackground=BG,
                       activeforeground=GREEN, font=('Segoe UI', 9)).pack(side='left')

        btn_row = tk.Frame(self, bg=BG)
        btn_row.pack(fill='x', padx=12, pady=12)
        ttk.Button(btn_row, text='Сохранить', style='Accent.TButton',
                   command=self._save).pack(side='left')
        ttk.Button(btn_row, text='Отмена', command=self.destroy).pack(side='left', padx=8)

        # Fill if editing
        if feature:
            cat_id = feature.get('cat', '')
            for i, c in enumerate(categories):
                if c['id'] == cat_id:
                    self.cat_combo.current(i)
                    break
            self.text_entry.insert(0, feature.get('text', ''))
            self.date_entry.insert(0, feature.get('date', ''))
            self.done_date_entry.insert(0, feature.get('doneDate', ''))
            self.done_var.set(feature.get('done', True))
        else:
            self.date_entry.insert(0, datetime.now().strftime('%d.%m.%Y'))
            self.done_var.set(False)

    def _save(self):
        cat_str = self.cat_var.get()
        cat_id = cat_str.split(' — ')[0] if ' — ' in cat_str else cat_str
        text = self.text_entry.get().strip()
        if not text:
            messagebox.showwarning('Ошибка', 'Укажите описание')
            return

        if self.feature:
            f = self.feature
        else:
            # Generate new ID
            max_id = max((feat.get('id', 0) for feat in features), default=0)
            if isinstance(max_id, str):
                max_id = 0
            f = {'id': max_id + 1, 'ver': self.ver}
            features.append(f)

        f['cat'] = cat_id
        f['text'] = text
        f['date'] = self.date_entry.get().strip()
        f['done'] = self.done_var.get()
        f['doneDate'] = self.done_date_entry.get().strip()

        if self.callback:
            self.callback()
        self.destroy()


# ─── Entry point ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    app = EditorApp()
    app.mainloop()
