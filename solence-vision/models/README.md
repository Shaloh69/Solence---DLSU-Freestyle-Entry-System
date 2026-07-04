# models/

Trained weights land here (`yolo/best.pt`, `unet/best.pt`) — gitignored.
Training scripts keep previous weights as `best-<timestamp>.pt` instead
of overwriting. If the team wants versioned weights, track this folder
with Git LFS or DVC rather than raw git.
