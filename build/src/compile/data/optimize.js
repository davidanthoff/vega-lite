import * as log from '../../log';
import { checkLinks } from './debug';
import { BottomUpOptimizer } from './optimizer';
import * as optimizers from './optimizers';
export var FACET_SCALE_PREFIX = 'scale_';
export var MAX_OPTIMIZATION_RUNS = 5;
/**
 * Return all leaf nodes.
 */
function getLeaves(roots) {
    var leaves = [];
    function append(node) {
        if (node.numChildren() === 0) {
            leaves.push(node);
        }
        else {
            node.children.forEach(append);
        }
    }
    roots.forEach(append);
    return leaves;
}
export function isTrue(x) {
    return x;
}
/**
 * Run the specified optimizer on the provided nodes.
 *
 * @param optimizer The optimizer to run.
 * @param nodes A set of nodes to optimize.
 * @param flag Flag that will be or'ed with return valued from optimization calls to the nodes.
 */
function runOptimizer(optimizer, nodes, flag) {
    var flags = nodes.map(function (node) {
        var optimizerInstance = new optimizer();
        if (optimizerInstance instanceof BottomUpOptimizer) {
            return optimizerInstance.optimizeNextFromLeaves(node);
        }
        else {
            return optimizerInstance.run(node);
        }
    });
    return flags.some(isTrue) || flag;
}
function optimizationDataflowHelper(dataComponent) {
    var roots = dataComponent.sources;
    var mutatedFlag = false;
    // mutatedFlag should always be on the right side otherwise short circuit logic might cause the mutating method to not execute
    mutatedFlag = runOptimizer(optimizers.RemoveUnnecessaryNodes, roots, mutatedFlag);
    // remove source nodes that don't have any children because they also don't have output nodes
    roots = roots.filter(function (r) { return r.numChildren() > 0; });
    mutatedFlag = runOptimizer(optimizers.RemoveUnusedSubtrees, getLeaves(roots), mutatedFlag);
    roots = roots.filter(function (r) { return r.numChildren() > 0; });
    mutatedFlag = runOptimizer(optimizers.MoveParseUp, getLeaves(roots), mutatedFlag);
    mutatedFlag = runOptimizer(optimizers.RemoveDuplicateTimeUnits, getLeaves(roots), mutatedFlag);
    mutatedFlag = runOptimizer(optimizers.MergeParse, getLeaves(roots), mutatedFlag);
    mutatedFlag = runOptimizer(optimizers.MergeAggregateNodes, getLeaves(roots), mutatedFlag);
    mutatedFlag = runOptimizer(optimizers.MergeIdenticalNodes, roots, mutatedFlag);
    dataComponent.sources = roots;
    return mutatedFlag;
}
/**
 * Optimizes the dataflow of the passed in data component.
 */
export function optimizeDataflow(data) {
    // check before optimizations
    checkLinks(data.sources);
    var firstPassCounter = 0;
    var secondPassCounter = 0;
    for (var i = 0; i < MAX_OPTIMIZATION_RUNS; i++) {
        if (!optimizationDataflowHelper(data)) {
            break;
        }
        firstPassCounter++;
    }
    // move facets down and make a copy of the subtree so that we can have scales at the top level
    data.sources.map(optimizers.moveFacetDown);
    for (var i = 0; i < MAX_OPTIMIZATION_RUNS; i++) {
        if (!optimizationDataflowHelper(data)) {
            break;
        }
        secondPassCounter++;
    }
    // check after optimizations
    checkLinks(data.sources);
    if (Math.max(firstPassCounter, secondPassCounter) === MAX_OPTIMIZATION_RUNS) {
        log.warn("Maximum optimization runs(" + MAX_OPTIMIZATION_RUNS + ") reached.");
    }
}
//# sourceMappingURL=optimize.js.map