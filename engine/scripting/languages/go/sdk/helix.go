                                                          
  
                                                                        
                                                                            
                                                                                  
                                                                             
                                         
  
                                                                              
                                                                               
                                                                             
                                                                            
                                        
package helix

import (
	"fmt"
	"math"
	"runtime"
	"strings"
)

                            
func hxRetain(ref uint32) uint32

                             
func hxRelease(ref uint32)

                          
func hxType(ref uint32) int32

                            
func hxEquals(a, b uint32) int32

                          
func hxRoot() uint32

                            
func hxScript() uint32

                          
func hxSelf() uint32

                             
func hxRequire(name string) uint32

                            
func hxNumber(v float64) uint32

                             
func hxBoolean(v int32) uint32

                            
func hxString(s string) uint32

                          
func hxNull() uint32

                           
func hxArray() uint32

                            
func hxObject() uint32

                              
func hxCallback(id uint32) uint32

                          
func hxPool(ref uint32) uint32

                               
func hxToNumber(ref uint32) float64

                                
func hxToBoolean(ref uint32) int32

                                  
func hxStringBytes(ref uint32) int32

                                 
func hxStringRead(ref uint32, buf *byte, capacity int32) int32

                         
func hxGet(obj uint32, key string) uint32

                           
func hxIndex(obj uint32, i int32) uint32

                         
func hxSet(obj uint32, key string, value uint32)

                               
func hxSetIndex(obj uint32, i int32, value uint32)

                         
func hxHas(obj uint32, key string) int32

                            
func hxDelete(obj uint32, key string)

                            
func hxLength(obj uint32) int32

                          
func hxKeys(obj uint32) uint32

                          
func hxCall(fn uint32, args *uint32, count int32) uint32

                            
func hxInvoke(obj uint32, method string, args *uint32, count int32) uint32

                               
func hxConstruct(ctor uint32, args *uint32, count int32) uint32

                         
func hxLog(level int32, message string)

                         
func hxNow() float64

                                
func hxFaultCell(cell *uint32)

                                
func hxFaultTake(buf *byte, capacity int32) int32

                                                                                             

                                                                                                  
var fault uint32

func init() {
	hxFaultCell(&fault)
}

                                                                       
type EngineError string

func (e EngineError) Error() string { return string(e) }

func check() {
	if fault != 0 {
		fail()
	}
}

func fail() {
	var buffer [2048]byte
	n := hxFaultTake(&buffer[0], int32(len(buffer)))
	if n > int32(len(buffer)) {
		n = int32(len(buffer))
	}
	panic(EngineError(string(buffer[:n])))
}

                                                                                            

                                                                 
type Kind int32



                                                          


                                                                                        


                                                                                            

                                                                                   



                                                                                              

                                                                                    


                                                                                                             

                                                                                               



                                              


                                                                                                

                                                                    

                                                      

                                                                                               

                                                                                                 

                      

                                              

                                                                                                

                                                                                   

                        

                                                                                                          




                                                                                

                                                                              

                                                                                         

                                                              

                                                                       

                                    

                                                                



                                                                                               

                                  

                             

                               

                                

                                          

                                        

                                                                                

                                                                                         
                                                                            

                                                                                              


                                                                       
  
                                    

                                                                                       
  
                                  

                                                                                                 

                                                                                          

                                                                                 

                                                                          

                                                                                                      

                                                      

                                                      


                                                                                         

                                    
