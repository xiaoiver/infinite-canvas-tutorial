/* @ts-self-types="./vello_renderer.d.ts" */

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addEllipse(canvas_id, opts) {
    wasm.addEllipse(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addGroup(canvas_id, opts) {
    wasm.addGroup(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addImageRect(canvas_id, opts) {
    wasm.addImageRect(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addLine(canvas_id, opts) {
    wasm.addLine(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addPath(canvas_id, opts) {
    wasm.addPath(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addPolyline(canvas_id, opts) {
    wasm.addPolyline(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addRect(canvas_id, opts) {
    wasm.addRect(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addRoughEllipse(canvas_id, opts) {
    wasm.addRoughEllipse(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addRoughLine(canvas_id, opts) {
    wasm.addRoughLine(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addRoughPath(canvas_id, opts) {
    wasm.addRoughPath(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addRoughPolyline(canvas_id, opts) {
    wasm.addRoughPolyline(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addRoughRect(canvas_id, opts) {
    wasm.addRoughRect(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function addText(canvas_id, opts) {
    wasm.addText(canvas_id, opts);
}

export function clearAllCaches() {
    wasm.clearAllCaches();
}

export function clearEmojiCache() {
    wasm.clearEmojiCache();
}

export function clearGlyphCache() {
    wasm.clearGlyphCache();
}

/**
 * @param {number} canvas_id
 */
export function clearShapes(canvas_id) {
    wasm.clearShapes(canvas_id);
}

/**
 * @param {any} opts
 * @returns {any}
 */
export function computePathBounds(opts) {
    const ret = wasm.computePathBounds(opts);
    return ret;
}

/**
 * @param {any} opts
 * @returns {any}
 */
export function computeTextBounds(opts) {
    const ret = wasm.computeTextBounds(opts);
    return ret;
}

/**
 * @param {any} opts
 * @returns {boolean}
 */
export function hitTestPath(opts) {
    const ret = wasm.hitTestPath(opts);
    return ret !== 0;
}

/**
 * @param {any} opts
 * @returns {any}
 */
export function measureFont(opts) {
    const ret = wasm.measureFont(opts);
    return ret;
}

/**
 * @param {any} js_value
 */
export function registerFont(js_value) {
    wasm.registerFont(js_value);
}

/**
 * @param {number} canvas_id
 */
export function restoreCanvasAfterExport(canvas_id) {
    wasm.restoreCanvasAfterExport(canvas_id);
}

/**
 * @param {any} canvas
 * @param {any} on_ready
 */
export function runWithCanvas(canvas, on_ready) {
    wasm.runWithCanvas(canvas, on_ready);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function setCameraTransform(canvas_id, opts) {
    wasm.setCameraTransform(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 */
export function setCanvasRenderOptions(canvas_id, opts) {
    wasm.setCanvasRenderOptions(canvas_id, opts);
}

/**
 * @param {number} canvas_id
 * @param {any} opts
 * @param {any} on_rendered
 */
export function setExportView(canvas_id, opts, on_rendered) {
    wasm.setExportView(canvas_id, opts, on_rendered);
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_83742b46f01ce22d: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_a5a435bd7bbec835: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_Window_c7f91e3f80ae0a0e: function(arg0) {
            const ret = arg0.Window;
            return ret;
        },
        __wbg_Window_e0df001eddf1d3fa: function(arg0) {
            const ret = arg0.Window;
            return ret;
        },
        __wbg_WorkerGlobalScope_d731e9136c6c49a0: function(arg0) {
            const ret = arg0.WorkerGlobalScope;
            return ret;
        },
        __wbg___wbindgen_bigint_get_as_i64_447a76b5c6ef7bda: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_c0f3f60bac5a78d1: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_5398f5bb970e0daa: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_41dbb8413020e076: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_e2141d4f045b7eda: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_3c846841762788c1: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_0b605fc6b167c56f: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_781bc9f159099513: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_7ef6b97b02428fae: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_52709e72fb9f179c: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_ee31bfad3e536463: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_5bcc3bed3c69e72b: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_34bb9d9dcfa21373: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_395e606bd0ee4427: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_6b5b6b8576d35cb1: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_abort_5ef96933660780b7: function(arg0) {
            arg0.abort();
        },
        __wbg_activeElement_c2981ba623ac16d9: function(arg0) {
            const ret = arg0.activeElement;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_addEventListener_2d985aa8a656f6dc: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.addEventListener(getStringFromWasm0(arg1, arg2), arg3);
        }, arguments); },
        __wbg_addListener_af610a227738fed8: function() { return handleError(function (arg0, arg1) {
            arg0.addListener(arg1);
        }, arguments); },
        __wbg_altKey_7f2c3a24bf5420ae: function(arg0) {
            const ret = arg0.altKey;
            return ret;
        },
        __wbg_altKey_a8e58d65866de029: function(arg0) {
            const ret = arg0.altKey;
            return ret;
        },
        __wbg_animate_8f41e2f47c7d04ab: function(arg0, arg1, arg2) {
            const ret = arg0.animate(arg1, arg2);
            return ret;
        },
        __wbg_appendChild_8cb157b6ec5612a6: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.appendChild(arg1);
            return ret;
        }, arguments); },
        __wbg_beginComputePass_d7b46482cf2ed824: function(arg0, arg1) {
            const ret = arg0.beginComputePass(arg1);
            return ret;
        },
        __wbg_beginRenderPass_373f34636d157c43: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.beginRenderPass(arg1);
            return ret;
        }, arguments); },
        __wbg_blockSize_5871fe73cc8dcba0: function(arg0) {
            const ret = arg0.blockSize;
            return ret;
        },
        __wbg_body_5eb99e7257e5ae34: function(arg0) {
            const ret = arg0.body;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_brand_3bc196a43eceb8af: function(arg0, arg1) {
            const ret = arg1.brand;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_brands_b7dcf262485c3e7c: function(arg0) {
            const ret = arg0.brands;
            return ret;
        },
        __wbg_buffer_60b8043cd926067d: function(arg0) {
            const ret = arg0.buffer;
            return ret;
        },
        __wbg_button_bdc91677bd7bbf58: function(arg0) {
            const ret = arg0.button;
            return ret;
        },
        __wbg_buttons_a18e71d5dcec8ba9: function(arg0) {
            const ret = arg0.buttons;
            return ret;
        },
        __wbg_call_2d781c1f4d5c0ef8: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_call_e133b57c9155d22c: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_cancelAnimationFrame_43fad84647f46036: function() { return handleError(function (arg0, arg1) {
            arg0.cancelAnimationFrame(arg1);
        }, arguments); },
        __wbg_cancelIdleCallback_d3eb47e732dd4bcd: function(arg0, arg1) {
            arg0.cancelIdleCallback(arg1 >>> 0);
        },
        __wbg_cancel_65f38182e2eeac5c: function(arg0) {
            arg0.cancel();
        },
        __wbg_catch_d7ed0375ab6532a5: function(arg0, arg1) {
            const ret = arg0.catch(arg1);
            return ret;
        },
        __wbg_clearBuffer_0439daeb4579be77: function(arg0, arg1, arg2) {
            arg0.clearBuffer(arg1, arg2);
        },
        __wbg_clearBuffer_3de757fe2da3e161: function(arg0, arg1, arg2, arg3) {
            arg0.clearBuffer(arg1, arg2, arg3);
        },
        __wbg_clearRect_ea4f3d34d76f4bc5: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.clearRect(arg1, arg2, arg3, arg4);
        },
        __wbg_clearTimeout_fdfb5a1468af1a97: function(arg0, arg1) {
            arg0.clearTimeout(arg1);
        },
        __wbg_close_ab55423854e61546: function(arg0) {
            arg0.close();
        },
        __wbg_code_3c69123dcbcf263d: function(arg0, arg1) {
            const ret = arg1.code;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_configure_b39d6ec9527208fd: function() { return handleError(function (arg0, arg1) {
            arg0.configure(arg1);
        }, arguments); },
        __wbg_contains_6b23671a193f58e5: function(arg0, arg1) {
            const ret = arg0.contains(arg1);
            return ret;
        },
        __wbg_contentRect_7047bba46353f683: function(arg0) {
            const ret = arg0.contentRect;
            return ret;
        },
        __wbg_copyBufferToBuffer_293ca0a0d09a2280: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.copyBufferToBuffer(arg1, arg2, arg3, arg4);
        }, arguments); },
        __wbg_copyBufferToBuffer_321eb0198eb9c268: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.copyBufferToBuffer(arg1, arg2, arg3, arg4, arg5);
        }, arguments); },
        __wbg_copyTextureToTexture_facf8ecdb9559cb0: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.copyTextureToTexture(arg1, arg2, arg3);
        }, arguments); },
        __wbg_createBindGroupLayout_f5bb5a31b2ac11bf: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createBindGroupLayout(arg1);
            return ret;
        }, arguments); },
        __wbg_createBindGroup_2290306cfa413c74: function(arg0, arg1) {
            const ret = arg0.createBindGroup(arg1);
            return ret;
        },
        __wbg_createBuffer_e2b25dd1471f92f7: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createBuffer(arg1);
            return ret;
        }, arguments); },
        __wbg_createCommandEncoder_80578730e7314357: function(arg0, arg1) {
            const ret = arg0.createCommandEncoder(arg1);
            return ret;
        },
        __wbg_createComputePipeline_78a3fff4e7d451a8: function(arg0, arg1) {
            const ret = arg0.createComputePipeline(arg1);
            return ret;
        },
        __wbg_createElement_9b0aab265c549ded: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.createElement(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_createObjectURL_f141426bcc1f70aa: function() { return handleError(function (arg0, arg1) {
            const ret = URL.createObjectURL(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_createPipelineLayout_0ef251301bed0c34: function(arg0, arg1) {
            const ret = arg0.createPipelineLayout(arg1);
            return ret;
        },
        __wbg_createRenderPipeline_f9f8aa23f50f8a9c: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createRenderPipeline(arg1);
            return ret;
        }, arguments); },
        __wbg_createSampler_27c37a8245da51a4: function(arg0, arg1) {
            const ret = arg0.createSampler(arg1);
            return ret;
        },
        __wbg_createShaderModule_eb21a131dfb0d4dc: function(arg0, arg1) {
            const ret = arg0.createShaderModule(arg1);
            return ret;
        },
        __wbg_createTexture_284160f981e0075f: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createTexture(arg1);
            return ret;
        }, arguments); },
        __wbg_createView_b09749798973b0f5: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.createView(arg1);
            return ret;
        }, arguments); },
        __wbg_crypto_38df2bab126b63dc: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_ctrlKey_6f8a95d15c098679: function(arg0) {
            const ret = arg0.ctrlKey;
            return ret;
        },
        __wbg_ctrlKey_a41da599a72ee93d: function(arg0) {
            const ret = arg0.ctrlKey;
            return ret;
        },
        __wbg_data_40ab3982572daa21: function(arg0, arg1) {
            const ret = arg1.data;
            const ptr1 = passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_deltaMode_e239727f16c7ad68: function(arg0) {
            const ret = arg0.deltaMode;
            return ret;
        },
        __wbg_deltaX_74ad854454fab779: function(arg0) {
            const ret = arg0.deltaX;
            return ret;
        },
        __wbg_deltaY_c6ccae416e166d01: function(arg0) {
            const ret = arg0.deltaY;
            return ret;
        },
        __wbg_devicePixelContentBoxSize_82a5f309b4b96a31: function(arg0) {
            const ret = arg0.devicePixelContentBoxSize;
            return ret;
        },
        __wbg_devicePixelRatio_c36a5fab28da634e: function(arg0) {
            const ret = arg0.devicePixelRatio;
            return ret;
        },
        __wbg_disconnect_09ddbc78942a2057: function(arg0) {
            arg0.disconnect();
        },
        __wbg_disconnect_21257e7fa524a113: function(arg0) {
            arg0.disconnect();
        },
        __wbg_dispatchWorkgroupsIndirect_31170e3ef9951e18: function(arg0, arg1, arg2) {
            arg0.dispatchWorkgroupsIndirect(arg1, arg2);
        },
        __wbg_dispatchWorkgroups_88dfc3f2209b9d74: function(arg0, arg1, arg2, arg3) {
            arg0.dispatchWorkgroups(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0);
        },
        __wbg_document_c0320cd4183c6d9b: function(arg0) {
            const ret = arg0.document;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_done_08ce71ee07e3bd17: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_draw_bcc050d6677121b5: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_end_05c67c1822b40952: function(arg0) {
            arg0.end();
        },
        __wbg_end_c269ebd826210ed1: function(arg0) {
            arg0.end();
        },
        __wbg_entries_e8a20ff8c9757101: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_error_8d9a8e04cd1d3588: function(arg0) {
            console.error(arg0);
        },
        __wbg_error_cfce0f619500de52: function(arg0, arg1) {
            console.error(arg0, arg1);
        },
        __wbg_eval_c311194bb27c7836: function() { return handleError(function (arg0, arg1) {
            const ret = eval(getStringFromWasm0(arg0, arg1));
            return ret;
        }, arguments); },
        __wbg_features_a239101d9dc0c094: function(arg0) {
            const ret = arg0.features;
            return ret;
        },
        __wbg_fillText_b1722b6179692b85: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.fillText(getStringFromWasm0(arg1, arg2), arg3, arg4);
        }, arguments); },
        __wbg_finish_073e2bc456a4b625: function(arg0) {
            const ret = arg0.finish();
            return ret;
        },
        __wbg_finish_e43b1b48427f2db0: function(arg0, arg1) {
            const ret = arg0.finish(arg1);
            return ret;
        },
        __wbg_focus_885197ce680db9e0: function() { return handleError(function (arg0) {
            arg0.focus();
        }, arguments); },
        __wbg_fullscreenElement_8068aa5be9c86543: function(arg0) {
            const ret = arg0.fullscreenElement;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_getCoalescedEvents_08e25b227866a984: function(arg0) {
            const ret = arg0.getCoalescedEvents();
            return ret;
        },
        __wbg_getCoalescedEvents_3e003f63d9ebbc05: function(arg0) {
            const ret = arg0.getCoalescedEvents;
            return ret;
        },
        __wbg_getComputedStyle_b12e52450a4be72c: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.getComputedStyle(arg1);
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getContext_a9236f98f1f7fe7c: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getContext_f04bf8f22dcb2d53: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getCurrentTexture_7edbea16b438c9fc: function() { return handleError(function (arg0) {
            const ret = arg0.getCurrentTexture();
            return ret;
        }, arguments); },
        __wbg_getImageData_88e532fe2924188e: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = arg0.getImageData(arg1, arg2, arg3, arg4);
            return ret;
        }, arguments); },
        __wbg_getOwnPropertyDescriptor_afeb931addada534: function(arg0, arg1) {
            const ret = Object.getOwnPropertyDescriptor(arg0, arg1);
            return ret;
        },
        __wbg_getPreferredCanvasFormat_56e30944cc798353: function(arg0) {
            const ret = arg0.getPreferredCanvasFormat();
            return (__wbindgen_enum_GpuTextureFormat.indexOf(ret) + 1 || 96) - 1;
        },
        __wbg_getPropertyValue_d2181532557839cf: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg1.getPropertyValue(getStringFromWasm0(arg2, arg3));
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_getRandomValues_c44a50d8cfdaebeb: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_get_326e41e095fb2575: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_3ef1eba1850ade27: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_a8ee5c45dabc1b3b: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_c7546417fb0bec10: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_get_unchecked_329cfe50afab7352: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_gpu_7c0927abcc96dd45: function(arg0) {
            const ret = arg0.gpu;
            return ret;
        },
        __wbg_has_abf74d2b4f3e578e: function(arg0, arg1, arg2) {
            const ret = arg0.has(getStringFromWasm0(arg1, arg2));
            return ret;
        },
        __wbg_height_6568c4427c3b889d: function(arg0) {
            const ret = arg0.height;
            return ret;
        },
        __wbg_height_8c06cb597de53887: function(arg0) {
            const ret = arg0.height;
            return ret;
        },
        __wbg_inlineSize_bc956acca480b3d7: function(arg0) {
            const ret = arg0.inlineSize;
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_101e2bf31071a9f6: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_CanvasRenderingContext2d_08b9d193c22fa886: function(arg0) {
            let result;
            try {
                result = arg0 instanceof CanvasRenderingContext2D;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_GpuAdapter_5e451ad6596e2784: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUAdapter;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_GpuCanvasContext_f70ee27f49f4f884: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUCanvasContext;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_HtmlCanvasElement_26125339f936be50: function(arg0) {
            let result;
            try {
                result = arg0 instanceof HTMLCanvasElement;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Map_f194b366846aca0c: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Map;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_740438561a5b956d: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Window_23e677d2c6843922: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Window;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_33b91feb269ff46e: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isIntersecting_b3e74fb0cf75f7d1: function(arg0) {
            const ret = arg0.isIntersecting;
            return ret;
        },
        __wbg_isSafeInteger_ecd6a7f9c3e053cd: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_is_a166b9958c2438ad: function(arg0, arg1) {
            const ret = Object.is(arg0, arg1);
            return ret;
        },
        __wbg_iterator_d8f549ec8fb061b1: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_key_99eb0f0a1000963d: function(arg0, arg1) {
            const ret = arg1.key;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_label_0abc44bf8d3a3e99: function(arg0, arg1) {
            const ret = arg1.label;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_length_b3416cf66a5452c8: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_ea16607d7b61445b: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_location_cb6f3af6ad563d81: function(arg0) {
            const ret = arg0.location;
            return ret;
        },
        __wbg_mapAsync_1be2f9e8f464f69e: function(arg0, arg1, arg2, arg3) {
            const ret = arg0.mapAsync(arg1 >>> 0, arg2, arg3);
            return ret;
        },
        __wbg_matchMedia_b27489ec503ba2a5: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.matchMedia(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_matches_d58caa45a0ef29a3: function(arg0) {
            const ret = arg0.matches;
            return ret;
        },
        __wbg_media_91e147d0112e864c: function(arg0, arg1) {
            const ret = arg1.media;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_metaKey_04074c2a59c1806c: function(arg0) {
            const ret = arg0.metaKey;
            return ret;
        },
        __wbg_metaKey_09c90f191df1276b: function(arg0) {
            const ret = arg0.metaKey;
            return ret;
        },
        __wbg_movementX_36b3256d18bcf681: function(arg0) {
            const ret = arg0.movementX;
            return ret;
        },
        __wbg_movementY_004a98ec08b8f584: function(arg0) {
            const ret = arg0.movementY;
            return ret;
        },
        __wbg_msCrypto_bd5a034af96bcba6: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_navigator_583ffd4fc14c0f7a: function(arg0) {
            const ret = arg0.navigator;
            return ret;
        },
        __wbg_navigator_9cebf56f28aa719b: function(arg0) {
            const ret = arg0.navigator;
            return ret;
        },
        __wbg_new_3acd383af1655b5f: function() { return handleError(function (arg0, arg1) {
            const ret = new Worker(getStringFromWasm0(arg0, arg1));
            return ret;
        }, arguments); },
        __wbg_new_42398a42abc5b110: function() { return handleError(function (arg0) {
            const ret = new IntersectionObserver(arg0);
            return ret;
        }, arguments); },
        __wbg_new_5f486cdf45a04d78: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_ab79df5bd7c26067: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_c518c60af666645b: function() { return handleError(function () {
            const ret = new AbortController();
            return ret;
        }, arguments); },
        __wbg_new_de704db0001dadc8: function() { return handleError(function (arg0) {
            const ret = new ResizeObserver(arg0);
            return ret;
        }, arguments); },
        __wbg_new_f7708ba82c4c12f6: function() { return handleError(function () {
            const ret = new MessageChannel();
            return ret;
        }, arguments); },
        __wbg_new_from_slice_22da9388ac046e50: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_bccac67128ed885a: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_with_length_825018a1616e9e55: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_new_with_str_sequence_and_options_a037535f6e1edba0: function() { return handleError(function (arg0, arg1) {
            const ret = new Blob(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_next_11b99ee6237339e3: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_next_e01a967809d1aa68: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_node_84ea875411254db1: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_now_e7c6795a7f81e10f: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_observe_571954223f11dad1: function(arg0, arg1, arg2) {
            arg0.observe(arg1, arg2);
        },
        __wbg_observe_a829ffd9907f84b1: function(arg0, arg1) {
            arg0.observe(arg1);
        },
        __wbg_observe_e1a1f270d8431b29: function(arg0, arg1) {
            arg0.observe(arg1);
        },
        __wbg_of_8bf7ed3eca00ea43: function(arg0) {
            const ret = Array.of(arg0);
            return ret;
        },
        __wbg_of_d6376e3774c51f89: function(arg0, arg1) {
            const ret = Array.of(arg0, arg1);
            return ret;
        },
        __wbg_offsetX_a9bf2ea7f0575ac9: function(arg0) {
            const ret = arg0.offsetX;
            return ret;
        },
        __wbg_offsetY_10e5433a1bbd4c01: function(arg0) {
            const ret = arg0.offsetY;
            return ret;
        },
        __wbg_onSubmittedWorkDone_7d532ba1f20a64b3: function(arg0) {
            const ret = arg0.onSubmittedWorkDone();
            return ret;
        },
        __wbg_performance_3fcf6e32a7e1ed0a: function(arg0) {
            const ret = arg0.performance;
            return ret;
        },
        __wbg_persisted_8366757621586c61: function(arg0) {
            const ret = arg0.persisted;
            return ret;
        },
        __wbg_play_3997a1be51d27925: function(arg0) {
            arg0.play();
        },
        __wbg_pointerId_85ff21be7b52f43e: function(arg0) {
            const ret = arg0.pointerId;
            return ret;
        },
        __wbg_pointerType_02525bef1df5f79c: function(arg0, arg1) {
            const ret = arg1.pointerType;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_port1_869a7ef90538dbdf: function(arg0) {
            const ret = arg0.port1;
            return ret;
        },
        __wbg_port2_947a51b8ba00adc9: function(arg0) {
            const ret = arg0.port2;
            return ret;
        },
        __wbg_postMessage_5ed5275983f7dad2: function() { return handleError(function (arg0, arg1, arg2) {
            arg0.postMessage(arg1, arg2);
        }, arguments); },
        __wbg_postMessage_c89a8b5edbf59ad0: function() { return handleError(function (arg0, arg1) {
            arg0.postMessage(arg1);
        }, arguments); },
        __wbg_postTask_e2439afddcdfbb55: function(arg0, arg1, arg2) {
            const ret = arg0.postTask(arg1, arg2);
            return ret;
        },
        __wbg_pressure_8a4698697b9bba06: function(arg0) {
            const ret = arg0.pressure;
            return ret;
        },
        __wbg_preventDefault_25a229bfe5c510f8: function(arg0) {
            arg0.preventDefault();
        },
        __wbg_process_44c7a14e11e9f69e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototype_0d5bb2023db3bcfc: function() {
            const ret = ResizeObserverEntry.prototype;
            return ret;
        },
        __wbg_prototypesetcall_d62e5099504357e6: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_e87b0e732085a946: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_querySelectorAll_ccbf0696a1c6fed8: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.querySelectorAll(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_queueMicrotask_0c399741342fb10f: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_queueMicrotask_9608487e970c906d: function(arg0, arg1) {
            arg0.queueMicrotask(arg1);
        },
        __wbg_queueMicrotask_a082d78ce798393e: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_queue_5eda23116e5d3adb: function(arg0) {
            const ret = arg0.queue;
            return ret;
        },
        __wbg_randomFillSync_6c25eac9869eb53c: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_removeEventListener_d27694700fc0df8b: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.removeEventListener(getStringFromWasm0(arg1, arg2), arg3);
        }, arguments); },
        __wbg_removeListener_7afb5d85c58c554b: function() { return handleError(function (arg0, arg1) {
            arg0.removeListener(arg1);
        }, arguments); },
        __wbg_removeProperty_5b3523637b608633: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg1.removeProperty(getStringFromWasm0(arg2, arg3));
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_repeat_44d6eeebd275606f: function(arg0) {
            const ret = arg0.repeat;
            return ret;
        },
        __wbg_requestAdapter_8efca1b953fd13aa: function(arg0, arg1) {
            const ret = arg0.requestAdapter(arg1);
            return ret;
        },
        __wbg_requestAnimationFrame_206c97f410e7a383: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.requestAnimationFrame(arg1);
            return ret;
        }, arguments); },
        __wbg_requestDevice_290c73161fe959d5: function(arg0, arg1) {
            const ret = arg0.requestDevice(arg1);
            return ret;
        },
        __wbg_requestFullscreen_3f16e43f398ce624: function(arg0) {
            const ret = arg0.requestFullscreen();
            return ret;
        },
        __wbg_requestFullscreen_b977a3a0697e883c: function(arg0) {
            const ret = arg0.requestFullscreen;
            return ret;
        },
        __wbg_requestIdleCallback_3689e3e38f6cfc02: function(arg0) {
            const ret = arg0.requestIdleCallback;
            return ret;
        },
        __wbg_requestIdleCallback_75108097af8f5c6a: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.requestIdleCallback(arg1);
            return ret;
        }, arguments); },
        __wbg_require_b4edbdcf3e2a1ef0: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_resolve_ae8d83246e5bcc12: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_revokeObjectURL_c4a7ed8e1908b794: function() { return handleError(function (arg0, arg1) {
            URL.revokeObjectURL(getStringFromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_scale_64e919c81a65aba9: function() { return handleError(function (arg0, arg1, arg2) {
            arg0.scale(arg1, arg2);
        }, arguments); },
        __wbg_scheduler_a17d41c9c822fc26: function(arg0) {
            const ret = arg0.scheduler;
            return ret;
        },
        __wbg_scheduler_b35fe73ba70e89cc: function(arg0) {
            const ret = arg0.scheduler;
            return ret;
        },
        __wbg_setAttribute_f20d3b966749ab64: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.setAttribute(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
        }, arguments); },
        __wbg_setBindGroup_1c8c11d4dd6528cf: function(arg0, arg1, arg2) {
            arg0.setBindGroup(arg1 >>> 0, arg2);
        },
        __wbg_setBindGroup_29f4a44dff76f1a4: function(arg0, arg1, arg2) {
            arg0.setBindGroup(arg1 >>> 0, arg2);
        },
        __wbg_setBindGroup_35a4830ac2c27742: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setBindGroup(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        }, arguments); },
        __wbg_setBindGroup_abde98bc542a4ae2: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setBindGroup(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        }, arguments); },
        __wbg_setPipeline_c91e0c8670443991: function(arg0, arg1) {
            arg0.setPipeline(arg1);
        },
        __wbg_setPipeline_e6ea6756d71b19a7: function(arg0, arg1) {
            arg0.setPipeline(arg1);
        },
        __wbg_setPointerCapture_b6e6a21fc0db7621: function() { return handleError(function (arg0, arg1) {
            arg0.setPointerCapture(arg1);
        }, arguments); },
        __wbg_setProperty_ef29d2aa64a04d2b: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.setProperty(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
        }, arguments); },
        __wbg_setTimeout_647865935a499f8b: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.setTimeout(arg1);
            return ret;
        }, arguments); },
        __wbg_setTimeout_7f7035ad0b026458: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.setTimeout(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_7eaa4f96924fd6b3: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_a_6f1653ca7319cdcf: function(arg0, arg1) {
            arg0.a = arg1;
        },
        __wbg_set_access_cbee993a36feed10: function(arg0, arg1) {
            arg0.access = __wbindgen_enum_GpuStorageTextureAccess[arg1];
        },
        __wbg_set_address_mode_u_38e255cd89ce1977: function(arg0, arg1) {
            arg0.addressModeU = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_address_mode_v_513f843d6e3c9dbd: function(arg0, arg1) {
            arg0.addressModeV = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_address_mode_w_801f70901a90ed5a: function(arg0, arg1) {
            arg0.addressModeW = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_alpha_0a28ffc800461787: function(arg0, arg1) {
            arg0.alpha = arg1;
        },
        __wbg_set_alpha_mode_55b4f33e93691fe8: function(arg0, arg1) {
            arg0.alphaMode = __wbindgen_enum_GpuCanvasAlphaMode[arg1];
        },
        __wbg_set_alpha_to_coverage_enabled_ec44695cc0d0e961: function(arg0, arg1) {
            arg0.alphaToCoverageEnabled = arg1 !== 0;
        },
        __wbg_set_array_layer_count_e774b6d4a5334e63: function(arg0, arg1) {
            arg0.arrayLayerCount = arg1 >>> 0;
        },
        __wbg_set_array_stride_11c840b41b728354: function(arg0, arg1) {
            arg0.arrayStride = arg1;
        },
        __wbg_set_aspect_2503cdfcdcc17373: function(arg0, arg1) {
            arg0.aspect = __wbindgen_enum_GpuTextureAspect[arg1];
        },
        __wbg_set_attributes_ac1030b589bf253a: function(arg0, arg1) {
            arg0.attributes = arg1;
        },
        __wbg_set_b_d5b23064b0492744: function(arg0, arg1) {
            arg0.b = arg1;
        },
        __wbg_set_base_array_layer_f64cdadf250d1a9b: function(arg0, arg1) {
            arg0.baseArrayLayer = arg1 >>> 0;
        },
        __wbg_set_base_mip_level_74fc97c2aaf8fc33: function(arg0, arg1) {
            arg0.baseMipLevel = arg1 >>> 0;
        },
        __wbg_set_beginning_of_pass_write_index_348e7f2f53a86db0: function(arg0, arg1) {
            arg0.beginningOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_beginning_of_pass_write_index_880bdf30cfb151c3: function(arg0, arg1) {
            arg0.beginningOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_bind_group_layouts_6f13eb021a550053: function(arg0, arg1) {
            arg0.bindGroupLayouts = arg1;
        },
        __wbg_set_binding_2240d98479c0c256: function(arg0, arg1) {
            arg0.binding = arg1 >>> 0;
        },
        __wbg_set_binding_5296904f2a4c7e25: function(arg0, arg1) {
            arg0.binding = arg1 >>> 0;
        },
        __wbg_set_blend_4aea897cd7d3c0f8: function(arg0, arg1) {
            arg0.blend = arg1;
        },
        __wbg_set_box_6a730e6c216d512c: function(arg0, arg1) {
            arg0.box = __wbindgen_enum_ResizeObserverBoxOptions[arg1];
        },
        __wbg_set_buffer_ba8ed06078d347f7: function(arg0, arg1) {
            arg0.buffer = arg1;
        },
        __wbg_set_buffer_fc9285180932669f: function(arg0, arg1) {
            arg0.buffer = arg1;
        },
        __wbg_set_buffers_72754529595d4bc0: function(arg0, arg1) {
            arg0.buffers = arg1;
        },
        __wbg_set_bytes_per_row_5fedf5a2d44b8482: function(arg0, arg1) {
            arg0.bytesPerRow = arg1 >>> 0;
        },
        __wbg_set_clear_value_1171de96edbc21fe: function(arg0, arg1) {
            arg0.clearValue = arg1;
        },
        __wbg_set_code_27a25a855d3fbc6d: function(arg0, arg1, arg2) {
            arg0.code = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_color_attachments_4516b6dfb4ad987b: function(arg0, arg1) {
            arg0.colorAttachments = arg1;
        },
        __wbg_set_color_f2ac28bdc576c010: function(arg0, arg1) {
            arg0.color = arg1;
        },
        __wbg_set_compare_2c8ee8ccaa2b6b5d: function(arg0, arg1) {
            arg0.compare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_compare_cbf49b43d3211833: function(arg0, arg1) {
            arg0.compare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_compute_e8ed640c578ae016: function(arg0, arg1) {
            arg0.compute = arg1;
        },
        __wbg_set_count_53854513da5c0e04: function(arg0, arg1) {
            arg0.count = arg1 >>> 0;
        },
        __wbg_set_cull_mode_3852dd4cff56dd90: function(arg0, arg1) {
            arg0.cullMode = __wbindgen_enum_GpuCullMode[arg1];
        },
        __wbg_set_depth_bias_c20861a58fc2b8d9: function(arg0, arg1) {
            arg0.depthBias = arg1;
        },
        __wbg_set_depth_bias_clamp_eecc04d702f9402e: function(arg0, arg1) {
            arg0.depthBiasClamp = arg1;
        },
        __wbg_set_depth_bias_slope_scale_b2a251d3d4c65018: function(arg0, arg1) {
            arg0.depthBiasSlopeScale = arg1;
        },
        __wbg_set_depth_clear_value_fca9e379a0cdff8f: function(arg0, arg1) {
            arg0.depthClearValue = arg1;
        },
        __wbg_set_depth_compare_7883e52aad39b925: function(arg0, arg1) {
            arg0.depthCompare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_depth_fail_op_1d11c8e03d061484: function(arg0, arg1) {
            arg0.depthFailOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_depth_load_op_7e95e67c69e09c5e: function(arg0, arg1) {
            arg0.depthLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_depth_or_array_layers_36ef1df107b6b651: function(arg0, arg1) {
            arg0.depthOrArrayLayers = arg1 >>> 0;
        },
        __wbg_set_depth_read_only_0c5e726b56520b08: function(arg0, arg1) {
            arg0.depthReadOnly = arg1 !== 0;
        },
        __wbg_set_depth_stencil_17e2d1710f4e07ae: function(arg0, arg1) {
            arg0.depthStencil = arg1;
        },
        __wbg_set_depth_stencil_attachment_a7b5eca74b7ddcfb: function(arg0, arg1) {
            arg0.depthStencilAttachment = arg1;
        },
        __wbg_set_depth_store_op_1b4cc257f121a4e7: function(arg0, arg1) {
            arg0.depthStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_depth_write_enabled_1551f99ae66d959e: function(arg0, arg1) {
            arg0.depthWriteEnabled = arg1 !== 0;
        },
        __wbg_set_device_846227515bb0301a: function(arg0, arg1) {
            arg0.device = arg1;
        },
        __wbg_set_dimension_7454baa9c745cf06: function(arg0, arg1) {
            arg0.dimension = __wbindgen_enum_GpuTextureDimension[arg1];
        },
        __wbg_set_dimension_9d314669636abc65: function(arg0, arg1) {
            arg0.dimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_dst_factor_8397030245674624: function(arg0, arg1) {
            arg0.dstFactor = __wbindgen_enum_GpuBlendFactor[arg1];
        },
        __wbg_set_end_of_pass_write_index_4600a261d0317ecb: function(arg0, arg1) {
            arg0.endOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_end_of_pass_write_index_9fec09fcc7da1609: function(arg0, arg1) {
            arg0.endOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_entries_4d13c932343146c3: function(arg0, arg1) {
            arg0.entries = arg1;
        },
        __wbg_set_entries_7e6b569918b11bf4: function(arg0, arg1) {
            arg0.entries = arg1;
        },
        __wbg_set_entry_point_7248ed25fb9070c7: function(arg0, arg1, arg2) {
            arg0.entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_entry_point_b01eb3970a1dcb95: function(arg0, arg1, arg2) {
            arg0.entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_entry_point_c8f041069c527ff6: function(arg0, arg1, arg2) {
            arg0.entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_external_texture_cf6cf39036321145: function(arg0, arg1) {
            arg0.externalTexture = arg1;
        },
        __wbg_set_fail_op_ac8f2b4c077715b1: function(arg0, arg1) {
            arg0.failOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_font_b038797b3573ae5e: function(arg0, arg1, arg2) {
            arg0.font = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_format_12bcbdd3428cd4b5: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_1fc8a436841b29c8: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_2a42ed14de233ae5: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuVertexFormat[arg1];
        },
        __wbg_set_format_3759d043ddc658d4: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_b08e529cc1612d7b: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_e0cf5a237864edb6: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_ffa0a97f114a945a: function(arg0, arg1) {
            arg0.format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_fragment_703ddd6f5db6e4af: function(arg0, arg1) {
            arg0.fragment = arg1;
        },
        __wbg_set_front_face_17a3723085696d9a: function(arg0, arg1) {
            arg0.frontFace = __wbindgen_enum_GpuFrontFace[arg1];
        },
        __wbg_set_g_4cc3b3e3231ca6f8: function(arg0, arg1) {
            arg0.g = arg1;
        },
        __wbg_set_has_dynamic_offset_dc25aba64b9bd3ff: function(arg0, arg1) {
            arg0.hasDynamicOffset = arg1 !== 0;
        },
        __wbg_set_height_98a1a397672657e2: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_height_ac705ece3aa08c95: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_height_b6548a01bdcb689a: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_label_10bd19b972ff1ba6: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_16cff4ff3c381368: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_343ceab4761679d7: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_403725ced930414e: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_62b82f9361718fb9: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_6afa181067c4da56: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_7d448e8a777d0d37: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_900e563567315063: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_98bef61fcbcecdde: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_9d2ce197e447a967: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_a19e77f79a88d021: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_b5d7ff5f8e4fbaac: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_ba288fbac1259847: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_e1bd2437f39d21f3: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_e4debe6dc9ea319b: function(arg0, arg1, arg2) {
            arg0.label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_layout_53be3643dc5dbbbe: function(arg0, arg1) {
            arg0.layout = arg1;
        },
        __wbg_set_layout_bb56309555eaa472: function(arg0, arg1) {
            arg0.layout = arg1;
        },
        __wbg_set_layout_ca5f863d331bb6b4: function(arg0, arg1) {
            arg0.layout = arg1;
        },
        __wbg_set_load_op_91d2cbf2912c96fd: function(arg0, arg1) {
            arg0.loadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_lod_max_clamp_01800ff5df00cc8e: function(arg0, arg1) {
            arg0.lodMaxClamp = arg1;
        },
        __wbg_set_lod_min_clamp_fe71be084b04bd97: function(arg0, arg1) {
            arg0.lodMinClamp = arg1;
        },
        __wbg_set_mag_filter_a6df09d1943d5caa: function(arg0, arg1) {
            arg0.magFilter = __wbindgen_enum_GpuFilterMode[arg1];
        },
        __wbg_set_mapped_at_creation_eb954cf5fdb9bc25: function(arg0, arg1) {
            arg0.mappedAtCreation = arg1 !== 0;
        },
        __wbg_set_mask_47a41aae6631771f: function(arg0, arg1) {
            arg0.mask = arg1 >>> 0;
        },
        __wbg_set_max_anisotropy_418bd200a56097a0: function(arg0, arg1) {
            arg0.maxAnisotropy = arg1;
        },
        __wbg_set_min_binding_size_d0315b751370234c: function(arg0, arg1) {
            arg0.minBindingSize = arg1;
        },
        __wbg_set_min_filter_5b27a7eb3f5ea88a: function(arg0, arg1) {
            arg0.minFilter = __wbindgen_enum_GpuFilterMode[arg1];
        },
        __wbg_set_mip_level_b50dccbd04935c98: function(arg0, arg1) {
            arg0.mipLevel = arg1 >>> 0;
        },
        __wbg_set_mip_level_count_307eb64d9d29e3a6: function(arg0, arg1) {
            arg0.mipLevelCount = arg1 >>> 0;
        },
        __wbg_set_mip_level_count_fe7f73daa6021aaa: function(arg0, arg1) {
            arg0.mipLevelCount = arg1 >>> 0;
        },
        __wbg_set_mipmap_filter_e1543204e8199db0: function(arg0, arg1) {
            arg0.mipmapFilter = __wbindgen_enum_GpuMipmapFilterMode[arg1];
        },
        __wbg_set_module_46b766d7fbe021b2: function(arg0, arg1) {
            arg0.module = arg1;
        },
        __wbg_set_module_9afd1b80ff72cee9: function(arg0, arg1) {
            arg0.module = arg1;
        },
        __wbg_set_module_ffe8f8e909e9fdcf: function(arg0, arg1) {
            arg0.module = arg1;
        },
        __wbg_set_multisample_957afdd96685c6f5: function(arg0, arg1) {
            arg0.multisample = arg1;
        },
        __wbg_set_multisampled_84e304d3a68838ea: function(arg0, arg1) {
            arg0.multisampled = arg1 !== 0;
        },
        __wbg_set_offset_3e78f3e530cf8049: function(arg0, arg1) {
            arg0.offset = arg1;
        },
        __wbg_set_offset_616ad7dfa51d50e0: function(arg0, arg1) {
            arg0.offset = arg1;
        },
        __wbg_set_offset_bea112c360dc7f2b: function(arg0, arg1) {
            arg0.offset = arg1;
        },
        __wbg_set_onmessage_f939f8b6d08ca76b: function(arg0, arg1) {
            arg0.onmessage = arg1;
        },
        __wbg_set_operation_6c5fd88df90bc7b2: function(arg0, arg1) {
            arg0.operation = __wbindgen_enum_GpuBlendOperation[arg1];
        },
        __wbg_set_origin_dec4f4c36f9f79f6: function(arg0, arg1) {
            arg0.origin = arg1;
        },
        __wbg_set_pass_op_461dabd5ee4ea1b7: function(arg0, arg1) {
            arg0.passOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_power_preference_a4ce891b22ea2b05: function(arg0, arg1) {
            arg0.powerPreference = __wbindgen_enum_GpuPowerPreference[arg1];
        },
        __wbg_set_primitive_eb8abbc5e7f278a4: function(arg0, arg1) {
            arg0.primitive = arg1;
        },
        __wbg_set_query_set_849fb32875f137d7: function(arg0, arg1) {
            arg0.querySet = arg1;
        },
        __wbg_set_query_set_c65a8f4d74f562f6: function(arg0, arg1) {
            arg0.querySet = arg1;
        },
        __wbg_set_r_5fa0f548248c394c: function(arg0, arg1) {
            arg0.r = arg1;
        },
        __wbg_set_required_features_98a83c7003fd73d5: function(arg0, arg1) {
            arg0.requiredFeatures = arg1;
        },
        __wbg_set_resolve_target_1ff405e060e2d32e: function(arg0, arg1) {
            arg0.resolveTarget = arg1;
        },
        __wbg_set_resource_1409c14d4d6b5a50: function(arg0, arg1) {
            arg0.resource = arg1;
        },
        __wbg_set_rows_per_image_8104dfe1b042a530: function(arg0, arg1) {
            arg0.rowsPerImage = arg1 >>> 0;
        },
        __wbg_set_sample_count_95a9892a60894677: function(arg0, arg1) {
            arg0.sampleCount = arg1 >>> 0;
        },
        __wbg_set_sample_type_f8f7b39d62e7b29c: function(arg0, arg1) {
            arg0.sampleType = __wbindgen_enum_GpuTextureSampleType[arg1];
        },
        __wbg_set_sampler_a2277e90dfe7395f: function(arg0, arg1) {
            arg0.sampler = arg1;
        },
        __wbg_set_shader_location_cdbcf5cf84a6cbcb: function(arg0, arg1) {
            arg0.shaderLocation = arg1 >>> 0;
        },
        __wbg_set_size_6f271c4c28c18e1b: function(arg0, arg1) {
            arg0.size = arg1;
        },
        __wbg_set_size_7ec162511b3bad1f: function(arg0, arg1) {
            arg0.size = arg1;
        },
        __wbg_set_size_ca765d983baccefd: function(arg0, arg1) {
            arg0.size = arg1;
        },
        __wbg_set_src_factor_e96f05a25f8383ed: function(arg0, arg1) {
            arg0.srcFactor = __wbindgen_enum_GpuBlendFactor[arg1];
        },
        __wbg_set_stencil_back_5c8971274cbcddcf: function(arg0, arg1) {
            arg0.stencilBack = arg1;
        },
        __wbg_set_stencil_clear_value_89ba97b367fa1385: function(arg0, arg1) {
            arg0.stencilClearValue = arg1 >>> 0;
        },
        __wbg_set_stencil_front_69f85bf4a6f02cb2: function(arg0, arg1) {
            arg0.stencilFront = arg1;
        },
        __wbg_set_stencil_load_op_a3e2c3a6f20d4da5: function(arg0, arg1) {
            arg0.stencilLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_stencil_read_mask_86a08afb2665c29b: function(arg0, arg1) {
            arg0.stencilReadMask = arg1 >>> 0;
        },
        __wbg_set_stencil_read_only_dd058fe8c6a1f6ae: function(arg0, arg1) {
            arg0.stencilReadOnly = arg1 !== 0;
        },
        __wbg_set_stencil_store_op_87c97415636844c9: function(arg0, arg1) {
            arg0.stencilStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_stencil_write_mask_7844d8a057a87a58: function(arg0, arg1) {
            arg0.stencilWriteMask = arg1 >>> 0;
        },
        __wbg_set_step_mode_285f2e428148f3b4: function(arg0, arg1) {
            arg0.stepMode = __wbindgen_enum_GpuVertexStepMode[arg1];
        },
        __wbg_set_storage_texture_373b9fc0e534dd33: function(arg0, arg1) {
            arg0.storageTexture = arg1;
        },
        __wbg_set_store_op_94575f47253d270d: function(arg0, arg1) {
            arg0.storeOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_strip_index_format_aeb7aa0e95e6285d: function(arg0, arg1) {
            arg0.stripIndexFormat = __wbindgen_enum_GpuIndexFormat[arg1];
        },
        __wbg_set_targets_93553735385af349: function(arg0, arg1) {
            arg0.targets = arg1;
        },
        __wbg_set_textAlign_8f846effafbae46d: function(arg0, arg1, arg2) {
            arg0.textAlign = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_textBaseline_a9304886c3f7ea50: function(arg0, arg1, arg2) {
            arg0.textBaseline = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_texture_6003a9e79918bf8a: function(arg0, arg1) {
            arg0.texture = arg1;
        },
        __wbg_set_texture_c5a457625c071b25: function(arg0, arg1) {
            arg0.texture = arg1;
        },
        __wbg_set_timestamp_writes_0603b32a31ee6205: function(arg0, arg1) {
            arg0.timestampWrites = arg1;
        },
        __wbg_set_timestamp_writes_f0a806787f57efc4: function(arg0, arg1) {
            arg0.timestampWrites = arg1;
        },
        __wbg_set_topology_5e4eb809635ea291: function(arg0, arg1) {
            arg0.topology = __wbindgen_enum_GpuPrimitiveTopology[arg1];
        },
        __wbg_set_type_0e707d4c06fc2b7b: function(arg0, arg1) {
            arg0.type = __wbindgen_enum_GpuSamplerBindingType[arg1];
        },
        __wbg_set_type_33e79f1b45a78c37: function(arg0, arg1, arg2) {
            arg0.type = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_type_6fe4c5f460401ee0: function(arg0, arg1) {
            arg0.type = __wbindgen_enum_GpuBufferBindingType[arg1];
        },
        __wbg_set_unclipped_depth_e9a2451e4fa0277a: function(arg0, arg1) {
            arg0.unclippedDepth = arg1 !== 0;
        },
        __wbg_set_usage_5abd566becc087bb: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_usage_61967f166fba5e13: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_usage_d0a75d4429098a06: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_usage_f0bb325677668e77: function(arg0, arg1) {
            arg0.usage = arg1 >>> 0;
        },
        __wbg_set_vertex_2525cfcd959b2add: function(arg0, arg1) {
            arg0.vertex = arg1;
        },
        __wbg_set_view_57d232eea19739c3: function(arg0, arg1) {
            arg0.view = arg1;
        },
        __wbg_set_view_dimension_49cfda500f1dea55: function(arg0, arg1) {
            arg0.viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_view_dimension_a669c29ec3b0813a: function(arg0, arg1) {
            arg0.viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_view_ffadd767d5e9b839: function(arg0, arg1) {
            arg0.view = arg1;
        },
        __wbg_set_view_formats_70a1fcabcd34282a: function(arg0, arg1) {
            arg0.viewFormats = arg1;
        },
        __wbg_set_view_formats_83865b9cdfda5cb6: function(arg0, arg1) {
            arg0.viewFormats = arg1;
        },
        __wbg_set_visibility_088046ee77c33b1d: function(arg0, arg1) {
            arg0.visibility = arg1 >>> 0;
        },
        __wbg_set_width_576343a4a7f2cf28: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_set_width_c0fcaa2da53cd540: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_set_width_e96e07f8255ad913: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_set_write_mask_76041c03688571cd: function(arg0, arg1) {
            arg0.writeMask = arg1 >>> 0;
        },
        __wbg_set_x_fdd6aca9a2390926: function(arg0, arg1) {
            arg0.x = arg1 >>> 0;
        },
        __wbg_set_y_410a18c5811abf4c: function(arg0, arg1) {
            arg0.y = arg1 >>> 0;
        },
        __wbg_set_z_f7f1ae8afd3a9308: function(arg0, arg1) {
            arg0.z = arg1 >>> 0;
        },
        __wbg_shiftKey_5256a2168f9dc186: function(arg0) {
            const ret = arg0.shiftKey;
            return ret;
        },
        __wbg_shiftKey_ec106aa0755af421: function(arg0) {
            const ret = arg0.shiftKey;
            return ret;
        },
        __wbg_signal_166e1da31adcac18: function(arg0) {
            const ret = arg0.signal;
            return ret;
        },
        __wbg_start_f837ba2bac4733b5: function(arg0) {
            arg0.start();
        },
        __wbg_static_accessor_GLOBAL_8adb955bd33fac2f: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_ad356e0db91c7913: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_f207c857566db248: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_bb9f1ba69d61b386: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_style_b01fc765f98b99ff: function(arg0) {
            const ret = arg0.style;
            return ret;
        },
        __wbg_subarray_a068d24e39478a8a: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_submit_21302eebe551e30d: function(arg0, arg1) {
            arg0.submit(arg1);
        },
        __wbg_then_098abe61755d12f6: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_then_9e335f6dd892bc11: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_bc59d1943397ca4e: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_unobserve_397ea595cb8bfdd0: function(arg0, arg1) {
            arg0.unobserve(arg1);
        },
        __wbg_userAgentData_31b8f893e8977e94: function(arg0) {
            const ret = arg0.userAgentData;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_userAgent_161a5f2d2a8dee61: function() { return handleError(function (arg0, arg1) {
            const ret = arg1.userAgent;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_value_21fc78aab0322612: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbg_versions_276b2795b1c6a219: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbg_visibilityState_8b47c97faee36457: function(arg0) {
            const ret = arg0.visibilityState;
            return (__wbindgen_enum_VisibilityState.indexOf(ret) + 1 || 3) - 1;
        },
        __wbg_webkitFullscreenElement_4055d847f8ff064e: function(arg0) {
            const ret = arg0.webkitFullscreenElement;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_webkitRequestFullscreen_c4ec4df7be373ffd: function(arg0) {
            arg0.webkitRequestFullscreen();
        },
        __wbg_width_4d6fc7fecd877217: function(arg0) {
            const ret = arg0.width;
            return ret;
        },
        __wbg_width_9824c1a2c17d3ebd: function(arg0) {
            const ret = arg0.width;
            return ret;
        },
        __wbg_writeBuffer_c6919ed0c4aaeef5: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.writeBuffer(arg1, arg2, arg3, arg4, arg5);
        }, arguments); },
        __wbg_writeTexture_340cfbecd9544755: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.writeTexture(arg1, arg2, arg3, arg4);
        }, arguments); },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [Externref], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("Array<any>"), NamedExternref("ResizeObserver")], shim_idx: 572, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h26ef4de1d2f17d97);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("Array<any>")], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_2);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("Event")], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_3);
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("FocusEvent")], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_4);
            return ret;
        },
        __wbindgen_cast_0000000000000006: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("KeyboardEvent")], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_5);
            return ret;
        },
        __wbindgen_cast_0000000000000007: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("PageTransitionEvent")], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_6);
            return ret;
        },
        __wbindgen_cast_0000000000000008: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("PointerEvent")], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_7);
            return ret;
        },
        __wbindgen_cast_0000000000000009: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [NamedExternref("WheelEvent")], shim_idx: 563, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_8);
            return ret;
        },
        __wbindgen_cast_000000000000000a: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 562, function: Function { arguments: [], shim_idx: 565, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2393627b061c6390, wasm_bindgen__convert__closures_____invoke__h0545557df07585f9);
            return ret;
        },
        __wbindgen_cast_000000000000000b: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 699, function: Function { arguments: [Externref], shim_idx: 700, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h5efe34e33761ee9b, wasm_bindgen__convert__closures_____invoke__h5ba874b0856b22eb);
            return ret;
        },
        __wbindgen_cast_000000000000000c: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 709, function: Function { arguments: [Externref], shim_idx: 710, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h50129e0239694893, wasm_bindgen__convert__closures_____invoke__hcd95a0b94c308f8e);
            return ret;
        },
        __wbindgen_cast_000000000000000d: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_000000000000000e: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_000000000000000f: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000010: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000011: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./vello_renderer_bg.js": import0,
    };
}

function wasm_bindgen__convert__closures_____invoke__h0545557df07585f9(arg0, arg1) {
    wasm.wasm_bindgen__convert__closures_____invoke__h0545557df07585f9(arg0, arg1);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_2(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_2(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_3(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_3(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_4(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_4(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_5(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_5(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_6(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_6(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_7(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_7(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_8(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_8(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h5ba874b0856b22eb(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h5ba874b0856b22eb(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__hcd95a0b94c308f8e(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__hcd95a0b94c308f8e(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen__convert__closures_____invoke__h26ef4de1d2f17d97(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures_____invoke__h26ef4de1d2f17d97(arg0, arg1, arg2, arg3);
}


const __wbindgen_enum_GpuAddressMode = ["clamp-to-edge", "repeat", "mirror-repeat"];


const __wbindgen_enum_GpuBlendFactor = ["zero", "one", "src", "one-minus-src", "src-alpha", "one-minus-src-alpha", "dst", "one-minus-dst", "dst-alpha", "one-minus-dst-alpha", "src-alpha-saturated", "constant", "one-minus-constant", "src1", "one-minus-src1", "src1-alpha", "one-minus-src1-alpha"];


const __wbindgen_enum_GpuBlendOperation = ["add", "subtract", "reverse-subtract", "min", "max"];


const __wbindgen_enum_GpuBufferBindingType = ["uniform", "storage", "read-only-storage"];


const __wbindgen_enum_GpuCanvasAlphaMode = ["opaque", "premultiplied"];


const __wbindgen_enum_GpuCompareFunction = ["never", "less", "equal", "less-equal", "greater", "not-equal", "greater-equal", "always"];


const __wbindgen_enum_GpuCullMode = ["none", "front", "back"];


const __wbindgen_enum_GpuFilterMode = ["nearest", "linear"];


const __wbindgen_enum_GpuFrontFace = ["ccw", "cw"];


const __wbindgen_enum_GpuIndexFormat = ["uint16", "uint32"];


const __wbindgen_enum_GpuLoadOp = ["load", "clear"];


const __wbindgen_enum_GpuMipmapFilterMode = ["nearest", "linear"];


const __wbindgen_enum_GpuPowerPreference = ["low-power", "high-performance"];


const __wbindgen_enum_GpuPrimitiveTopology = ["point-list", "line-list", "line-strip", "triangle-list", "triangle-strip"];


const __wbindgen_enum_GpuSamplerBindingType = ["filtering", "non-filtering", "comparison"];


const __wbindgen_enum_GpuStencilOperation = ["keep", "zero", "replace", "invert", "increment-clamp", "decrement-clamp", "increment-wrap", "decrement-wrap"];


const __wbindgen_enum_GpuStorageTextureAccess = ["write-only", "read-only", "read-write"];


const __wbindgen_enum_GpuStoreOp = ["store", "discard"];


const __wbindgen_enum_GpuTextureAspect = ["all", "stencil-only", "depth-only"];


const __wbindgen_enum_GpuTextureDimension = ["1d", "2d", "3d"];


const __wbindgen_enum_GpuTextureFormat = ["r8unorm", "r8snorm", "r8uint", "r8sint", "r16uint", "r16sint", "r16float", "rg8unorm", "rg8snorm", "rg8uint", "rg8sint", "r32uint", "r32sint", "r32float", "rg16uint", "rg16sint", "rg16float", "rgba8unorm", "rgba8unorm-srgb", "rgba8snorm", "rgba8uint", "rgba8sint", "bgra8unorm", "bgra8unorm-srgb", "rgb9e5ufloat", "rgb10a2uint", "rgb10a2unorm", "rg11b10ufloat", "rg32uint", "rg32sint", "rg32float", "rgba16uint", "rgba16sint", "rgba16float", "rgba32uint", "rgba32sint", "rgba32float", "stencil8", "depth16unorm", "depth24plus", "depth24plus-stencil8", "depth32float", "depth32float-stencil8", "bc1-rgba-unorm", "bc1-rgba-unorm-srgb", "bc2-rgba-unorm", "bc2-rgba-unorm-srgb", "bc3-rgba-unorm", "bc3-rgba-unorm-srgb", "bc4-r-unorm", "bc4-r-snorm", "bc5-rg-unorm", "bc5-rg-snorm", "bc6h-rgb-ufloat", "bc6h-rgb-float", "bc7-rgba-unorm", "bc7-rgba-unorm-srgb", "etc2-rgb8unorm", "etc2-rgb8unorm-srgb", "etc2-rgb8a1unorm", "etc2-rgb8a1unorm-srgb", "etc2-rgba8unorm", "etc2-rgba8unorm-srgb", "eac-r11unorm", "eac-r11snorm", "eac-rg11unorm", "eac-rg11snorm", "astc-4x4-unorm", "astc-4x4-unorm-srgb", "astc-5x4-unorm", "astc-5x4-unorm-srgb", "astc-5x5-unorm", "astc-5x5-unorm-srgb", "astc-6x5-unorm", "astc-6x5-unorm-srgb", "astc-6x6-unorm", "astc-6x6-unorm-srgb", "astc-8x5-unorm", "astc-8x5-unorm-srgb", "astc-8x6-unorm", "astc-8x6-unorm-srgb", "astc-8x8-unorm", "astc-8x8-unorm-srgb", "astc-10x5-unorm", "astc-10x5-unorm-srgb", "astc-10x6-unorm", "astc-10x6-unorm-srgb", "astc-10x8-unorm", "astc-10x8-unorm-srgb", "astc-10x10-unorm", "astc-10x10-unorm-srgb", "astc-12x10-unorm", "astc-12x10-unorm-srgb", "astc-12x12-unorm", "astc-12x12-unorm-srgb"];


const __wbindgen_enum_GpuTextureSampleType = ["float", "unfilterable-float", "depth", "sint", "uint"];


const __wbindgen_enum_GpuTextureViewDimension = ["1d", "2d", "2d-array", "cube", "cube-array", "3d"];


const __wbindgen_enum_GpuVertexFormat = ["uint8", "uint8x2", "uint8x4", "sint8", "sint8x2", "sint8x4", "unorm8", "unorm8x2", "unorm8x4", "snorm8", "snorm8x2", "snorm8x4", "uint16", "uint16x2", "uint16x4", "sint16", "sint16x2", "sint16x4", "unorm16", "unorm16x2", "unorm16x4", "snorm16", "snorm16x2", "snorm16x4", "float16", "float16x2", "float16x4", "float32", "float32x2", "float32x3", "float32x4", "uint32", "uint32x2", "uint32x3", "uint32x4", "sint32", "sint32x2", "sint32x3", "sint32x4", "unorm10-10-10-2", "unorm8x4-bgra"];


const __wbindgen_enum_GpuVertexStepMode = ["vertex", "instance"];


const __wbindgen_enum_ResizeObserverBoxOptions = ["border-box", "content-box", "device-pixel-content-box"];


const __wbindgen_enum_VisibilityState = ["hidden", "visible"];

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => state.dtor(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            state.dtor(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('vello_renderer_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
