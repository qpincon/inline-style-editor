<script>
    import Picker from "vanilla-picker/csp";
    import { onMount, onDestroy } from "svelte";

    // Props
    let { value = $bindable("#AAAAAAFF"), options = {}, onChange = () => {} } = $props();

    // State
    let self = $state();
    let pickerElem = $state();

    // Effect to update picker when value changes
    $effect(() => {
        if (pickerElem) {
            pickerElem.setColor(value);
        }
    });

    export function setColor(rgbaString) {
        pickerElem.setColor(rgbaString);
    }

    function setValue(val) {
        if (val === value) return;
        onChange(val, value);
        value = val;
    }

    function _onChange(color) {
        setValue(color.hex);
    }

    onMount(() => {
        init(options);
    });

    onDestroy(() => {
        pickerElem?.destroy();
    });

    function init(opts) {
        if (!self) return;
        if (pickerElem) pickerElem.destroy();
        opts.onChange = _onChange;
        pickerElem = new Picker({
            parent: self,
            color: value,
            popup: false,
            ...opts,
        });
        pickerElem.show();
        pickerElem.openHandler();
    }
</script>

<div class="picker" bind:this={self}></div>
