import { AfterViewInit, Component, Input, NgZone, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { byteToHex } from '../../../globals';
import * as d3 from 'd3';
import * as Store from 'electron-store';
import { easing, styler, tween } from 'popmotion';
import * as isDev from 'electron-is-dev';
import * as path from 'path';
import { SimLibInterfaceService } from '../../../core/services/sim-lib-interface/sim-lib-interface.service';
import { DataService } from '../../../core/services/data.service';
import { readStyleProperty } from '../../../utils/helper';

class Assembly {
  opcode: string;
  hex: string;
  pc: number;
}

class SectionSymbol {
  name?: string;
  hex?: string;
  code?: {
    code?: string;
    line?: number;
    file?: string;
    assembly?: Assembly[] | Assembly;
  }[];
}

class Section {
  name: string;
  symbols: SectionSymbol[];
}

@Component({
  selector: 'app-instructions',
  templateUrl: './instructions.component.html',
  styleUrls: ['./instructions.component.scss'],
})
export class InstructionsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  public sections: Section[] = [];
  public byteToHex = byteToHex;
  @Input() private programCounter;
  @Input() private elfPath;
  private store = new Store();
  private toolchainPath = this.store.get('toolchainPath', '');
  private toolchainPrefix = this.store.get('toolchainPrefix', '');
  private objdumpPath = path.join(this.toolchainPath, this.toolchainPrefix + 'objdump');
  private isRunning = false;

  constructor(
    private simLibInterfaceService: SimLibInterfaceService,
    private dataService: DataService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Reload instructions from last initiation
    if (this.dataService.instructionsSections) {
      this.sections = this.dataService.instructionsSections;
    }
  }

  ngAfterViewInit(): void {
    // If the instructions were reloaded set the program counter
    // Needs to be after view loaded to access the relevant dom elements
    this.setInstructionColor(0, this.programCounter);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.programCounter)
      if (changes.programCounter.currentValue !== changes.programCounter.previousValue) {
        this.setInstructionColor(changes.programCounter.previousValue, changes.programCounter.currentValue);
      }
  }

  public reload() {
    if (this.elfPath.indexOf('.elf') > 0) {
      if (!this.isRunning) {
        this.isRunning = true;
        const objdumpWorker = new Worker('./static/objdump.worker.js');
        objdumpWorker.onmessage = (e) => {
          this.ngZone.run(() => {
            // Emitted when the elf changed and instructions needed to be renewed
            this.sections = e.data;
            // Save instructions
            this.dataService.instructionsSections = this.sections;
            setTimeout(() => {
              this.setInstructionColor(0, this.programCounter);
            }, 100);
            objdumpWorker.terminate();
            this.isRunning = false;
          });
        };
        objdumpWorker.postMessage({ file: this.elfPath, isDev: isDev, objdumpPath: this.objdumpPath });
      }
    }
  }

  ngOnDestroy() {}

  private setInstructionColor(oldPC, newPC) {
    // Change colors accordingly
    const oldAssemblyDiv = document.getElementById('assembly-code-div-' + oldPC);
    if (oldAssemblyDiv) {
      tween({
        from: { backgroundColor: oldAssemblyDiv.style.backgroundColor },
        to: { backgroundColor: readStyleProperty('accent-dark') },
        ease: easing.easeOut,
        duration: 500,
      }).start((v) => styler(oldAssemblyDiv).set(v));
    }
    const oldAssemblyPcDiv = document.getElementById('assembly-code-div-pc-' + oldPC);
    const oldAssemblyHexDiv = document.getElementById('assembly-code-div-hex-' + oldPC);
    if (oldAssemblyPcDiv && oldAssemblyHexDiv) {
      tween({
        from: { backgroundColor: oldAssemblyPcDiv.style.backgroundColor },
        to: { backgroundColor: readStyleProperty('accent') },
        ease: easing.easeOut,
        duration: 500,
      }).start((v) => {
        styler(oldAssemblyPcDiv).set(v);
        styler(oldAssemblyHexDiv).set(v);
      });
    }
    d3.select('#assembly-code-div-' + newPC).style('background', readStyleProperty('accent'));
    d3.select('#assembly-code-div-' + newPC).style('border-color', 'transparent');
    d3.select('#assembly-code-div-pc-' + newPC).style('background', readStyleProperty('accent-dark'));
    d3.select('#assembly-code-div-pc-' + newPC).style('border-color', 'transparent');
    d3.select('#assembly-code-div-hex-' + newPC).style('background', readStyleProperty('accent-dark'));
    d3.select('#assembly-code-div-hex-' + newPC).style('border-color', 'transparent');
  }
}