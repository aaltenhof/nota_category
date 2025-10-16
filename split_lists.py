import pandas as pd
import numpy as np

df = pd.read_csv("master_word_list.csv")

ignore_words = {
    "cat", "fish", "egg", "apple", "shirts", "shoe", "finger", "tooth",
    "hammer", "purse", "kitchen", "stairs", "ladder", "sun", "home",
    "picnic", "mom", "cowboy", "eating", "walking", "opening", "touching",
    "swimming", "watching", "asleep", "bad", "brown", "yellow", "today",
    "up", "beside"
}

df_filtered = df[~df["word"].str.lower().isin(ignore_words)].reset_index(drop=True)
df_shuffled = df_filtered.sample(frac=1, random_state=42).reset_index(drop=True)


num_splits = 7
splits = np.array_split(df_shuffled, num_splits)

for i, split in enumerate(splits, start=1):
    split = split.copy()
    split["list_type"] = i
    split.to_csv(f"lists/wordlist{i}.csv", index=False)

