/// <reference types="@solidjs/start/env" />

interface Navigator {
	gpu?: {
		requestAdapter(): Promise<GPUAdapter | null>;
	};
}

interface GPUDevice {
	createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
	createComputePipeline(
		descriptor: GPUComputePipelineDescriptor,
	): GPUComputePipeline;
	createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
	createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
	createCommandEncoder(): GPUCommandEncoder;
	queue: GPUQueue;
}

interface GPUAdapter {
	requestDevice(): Promise<GPUDevice>;
}

interface GPUShaderModuleDescriptor {
	code: string;
}

type GPUShaderModule = {};

interface GPUComputePipelineDescriptor {
	compute: {
		module: GPUShaderModule;
		entryPoint: string;
	};
	layout: "auto" | GPUPipelineLayout;
}

interface GPUComputePipeline {
	getBindGroupLayout(index: number): GPUBindGroupLayout;
}

type GPUPipelineLayout = {};

type GPUBindGroupLayout = {};

interface GPUBufferDescriptor {
	size: number;
	usage: number;
}

interface GPUBuffer {
	mapAsync(mode: number): Promise<void>;
	getMappedRange(): ArrayBuffer;
	unmap(): void;
	destroy(): void;
}

interface GPUQueue {
	writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void;
	submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUBindGroupDescriptor {
	layout: GPUBindGroupLayout;
	entries: GPUBindGroupEntry[];
}

interface GPUBindGroupEntry {
	binding: number;
	resource: { buffer: GPUBuffer };
}

type GPUBindGroup = {};

interface GPUCommandEncoder {
	beginComputePass(): GPUComputePassEncoder;
	copyBufferToBuffer(
		source: GPUBuffer,
		sourceOffset: number,
		destination: GPUBuffer,
		destinationOffset: number,
		size: number,
	): void;
	finish(): GPUCommandBuffer;
}

interface GPUComputePassEncoder {
	setPipeline(pipeline: GPUComputePipeline): void;
	setBindGroup(index: number, bindGroup: GPUBindGroup): void;
	dispatchWorkgroups(
		workgroupCountX: number,
		workgroupCountY?: number,
		workgroupCountZ?: number,
	): void;
	end(): void;
}

type GPUCommandBuffer = {};

declare const GPUBufferUsage: {
	STORAGE: number;
	COPY_DST: number;
	COPY_SRC: number;
	UNIFORM: number;
	MAP_READ: number;
};

declare const GPUMapMode: {
	READ: number;
};
