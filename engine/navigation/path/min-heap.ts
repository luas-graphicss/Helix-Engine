const INITIAL_CAPACITY = 64;
export class MinHeap {
    private nodes = new Int32Array(INITIAL_CAPACITY);
    private priorities = new Float32Array(INITIAL_CAPACITY);
    private size = 0;
    get isEmpty(): boolean {
        return this.size === 0;
    }
    clear(): void {
        this.size = 0;
    }
    push(node: number, priority: number): void {
        if (this.size === this.nodes.length)
            this.grow();
        let slot = this.size++;
        while (slot > 0) {
            const parent = (slot - 1) >> 1;
            if (this.priorities[parent] <= priority)
                break;
            this.nodes[slot] = this.nodes[parent];
            this.priorities[slot] = this.priorities[parent];
            slot = parent;
        }
        this.nodes[slot] = node;
        this.priorities[slot] = priority;
    }
    pop(): number {
        const top = this.nodes[0];
        const last = --this.size;
        const node = this.nodes[last];
        const priority = this.priorities[last];
        let slot = 0;
        for (let child = 1; child < last; child = slot * 2 + 1) {
            if (child + 1 < last && this.priorities[child + 1] < this.priorities[child])
                child++;
            if (this.priorities[child] >= priority)
                break;
            this.nodes[slot] = this.nodes[child];
            this.priorities[slot] = this.priorities[child];
            slot = child;
        }
        this.nodes[slot] = node;
        this.priorities[slot] = priority;
        return top;
    }
    private grow(): void {
        const nodes = new Int32Array(this.nodes.length * 2);
        const priorities = new Float32Array(this.priorities.length * 2);
        nodes.set(this.nodes);
        priorities.set(this.priorities);
        this.nodes = nodes;
        this.priorities = priorities;
    }
}
