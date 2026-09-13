# The variance desk is posting the wrong stock decisions

I’m clearing the North mezzanine count queue, but a second count does not replace the earlier one and inbound stock is being treated as if it were already in the bin. The physical variance should compare the latest count with on-hand stock; in-transit units belong in Available, not in that variance.

The adjacent A-01 and A-02 shortages and overages are the same stock move, yet LINK TRANSPOSE will not join them. Equal and opposite variances for different SKUs in neighboring bins should close together without a write-off. Small differences up to and including the displayed threshold may be adjusted, while anything larger stays open for another count. A serialized shortage must also have the missing serial evidence before ADJUST is available.

Changing a queue filter should not silently switch the case I am reviewing. Decisions and recounts need to survive refresh, and UNDO should restore the complete case—including its count history, stock, status, and linked decision—rather than only changing the label.

The two sides of the reconciliation sheet are also out of register, so a physical count can appear opposite the wrong SKU. On a phone the sheet runs beyond the edge and the decision dock covers the evidence. This is the view I get:

<img src="/app/problem_assets/broken.png" alt="current variance desk" width="900" />

I need the expected and counted rows aligned, with all evidence and decision controls contained like this:

<img src="/app/problem_assets/target.png" alt="usable variance desk" width="900" />
