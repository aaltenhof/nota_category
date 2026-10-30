#!/usr/bin/env python3
"""Build the trial lists for the contrast-annotation task.

For each target word x part of speech, counts responses by `lexeme` (so veggie / vegetables / vegetable
are one item), keeps the most frequent responses, shows verb responses in their -ing form (see ing_forms), attaches the sentence frame from master_word_list.csv,
and splits the targets into lists of LIST_SIZE. Parts of speech are dealt round-robin so every list has
roughly the same mix of nouns, verbs and adjectives.

Run from inside annotation_task/:
  python3 make_trial_lists.py
"""
import os, re
import pandas as pd

INPUT_FILE = '../pos_pipeline/data/final/nota_main.csv'
FRAME_FILE = '../master_word_list.csv'
OUTPUT_DIR = 'trial_lists'
RANDOM_SEED = 22

MAX_RESPONSES = 12      # top N responses shown per target
MIN_COUNT = 3           # a response needs at least this many people to be shown
LIST_SIZE = 20          # targets per participant
MIN_SHOWN = 1           # drop targets with fewer than this many responses left after filtering

# same mapping as word_sheets.py (adverbs are treated as adjectives)
POS = {'noun': 'noun', 'verb': 'verb', 'adjective': 'adj', 'adverb': 'adj'}

KEEP_COLUMNS = ['target_word', 'target_pos', 'target_cat',
                'sentence_frame_before', 'sentence_frame_after', 'clarification',
                'n_total', 'n_unique', 'n_shown']
RESPONSE_COLUMNS = [f'{c}{i}' for i in range(1, MAX_RESPONSES + 1) for c in ('response', 'count', 'lexeme')]


def load_frames():
    # sentence frames, keyed on lowercased word + mapped pos
    f = pd.read_csv(FRAME_FILE, keep_default_na=False)
    f['target'] = f.word.astype(str).str.strip().str.lower()
    f['pos'] = f.pos.astype(str).str.strip().str.lower().map(POS).fillna(f.pos)
    f = f.rename(columns={'cat': 'target_cat'})
    return f[['target', 'pos', 'word', 'target_cat',
              'sentence_frame_before', 'sentence_frame_after', 'clarification']]


def ing_forms(d):
    # lexeme -> the -ing spelling participants typed most often, across all targets (stand still -> standing still)
    has_ing = d[d.response.astype(str).str.split().str[0].str.endswith('ing')]
    return has_ing.groupby('lexeme').response.agg(lambda s: s.value_counts().index[0]).to_dict()


def display_form(lexeme, g, ing):
    # Verb targets: counts stay by lexeme, but show the -ing form people actually typed. Prefer the form used
    # for this target, then the most common one anywhere, then whatever was typed most for this target.
    typed = g.loc[g.lexeme == lexeme, 'response'].astype(str)
    typed_ing = typed[typed.str.split().str[0].str.endswith('ing')]
    if len(typed_ing):
        return typed_ing.value_counts().index[0]
    if lexeme in ing:
        return ing[lexeme]
    return typed.value_counts().index[0] if len(typed) else lexeme


def build_items(d, frames):
    ing = ing_forms(d)
    items = []
    for (t, pos), g in d.groupby(['target', 'pos']):
        c = (g['lexeme'].value_counts().rename_axis('response').reset_index(name='count')
               .sort_values(['count', 'response'], ascending=[False, True]))
        shown = c[c['count'] >= MIN_COUNT].head(MAX_RESPONSES)

        row = {'target': t, 'pos': pos, 'n_total': len(g), 'n_unique': len(c), 'n_shown': len(shown)}
        for i, (lex, n) in enumerate(zip(shown.response, shown['count']), start=1):
            row[f'response{i}'] = display_form(lex, g, ing) if pos == 'verb' else lex
            row[f'count{i}'] = int(n)
            row[f'lexeme{i}'] = lex
        items.append(row)

    items = pd.DataFrame(items)
    items = items.merge(frames, on=['target', 'pos'], how='left')

    # keep the original capitalization from the master list for display (e.g. "After")
    missing = items.word.isna()
    if missing.any():
        print(f"WARNING: no sentence frame for {items[missing].target.tolist()}")
    items['target_word'] = items.word.fillna(items.target)
    items['target_pos'] = items.pos
    return items


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # load data
    d = pd.read_csv(INPUT_FILE, low_memory=False)
    d = d[d['lexeme'].notna()].copy()
    d['target'] = d.target_word.astype(str).str.strip().str.lower()
    d['pos'] = d.target_pos.astype(str).str.strip().str.lower().map(POS).fillna(d.target_pos)

    items = build_items(d, load_frames())

    # near-unanimous targets (dog -> cat) may only have one response left; these are still labeled
    single = items[items.n_shown == 1]
    if len(single):
        print(f"{len(single)} targets have only one response at count >= {MIN_COUNT}: "
              f"{(single.target + '_' + single.pos).tolist()}")
    too_few = items[items.n_shown < MIN_SHOWN]
    if len(too_few):
        print(f"dropping {len(too_few)} targets with < {MIN_SHOWN} responses: "
              f"{(too_few.target + '_' + too_few.pos).tolist()}")
    items = items[items.n_shown >= MIN_SHOWN]

    # shuffle, then deal each pos round-robin across lists so the pos mix is balanced
    n_lists = -(-len(items) // LIST_SIZE)
    items = items.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)
    items = items.sort_values('pos', kind='stable').reset_index(drop=True)
    items['list_num'] = [(i % n_lists) + 1 for i in range(len(items))]

    columns = ['list_num'] + KEEP_COLUMNS + RESPONSE_COLUMNS
    for list_num, file_df in items.groupby('list_num'):
        file_df = file_df.reindex(columns=columns)
        file_df[[f'count{i}' for i in range(1, MAX_RESPONSES + 1)]] = \
            file_df[[f'count{i}' for i in range(1, MAX_RESPONSES + 1)]].astype('Int64')
        filepath = os.path.join(OUTPUT_DIR, f'file{list_num}.csv')
        file_df.to_csv(filepath, index=False)

    # summary
    summary = items.groupby('list_num').agg(n_targets=('target', 'size'),
                                            n_noun=('pos', lambda p: (p == 'noun').sum()),
                                            n_verb=('pos', lambda p: (p == 'verb').sum()),
                                            n_adj=('pos', lambda p: (p == 'adj').sum()),
                                            n_chips=('n_shown', 'sum'))
    summary.to_csv(os.path.join(OUTPUT_DIR, '_list_summary.csv'))
    print(f"wrote {n_lists} lists of up to {LIST_SIZE} targets to {OUTPUT_DIR}/")
    print(f"  responses shown per target: median {items.n_shown.median():.0f}, "
          f"range {items.n_shown.min()}-{items.n_shown.max()}")
    print(f"  responses shown per list: range {summary.n_chips.min()}-{summary.n_chips.max()}")


if __name__ == '__main__':
    main()
